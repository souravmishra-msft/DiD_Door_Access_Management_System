const router = require('express').Router();
const dotenv = require('dotenv');
const session = require('express-session');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const uuid = require('uuid');
const { cca, msalClientCredentialRequest } = require('../Auth/msalAuth');
const issuanceConfigFile = require('../config/issuance_request_config.json');
const authConfig = require('../config/config.json');
const parser = bodyParser.urlencoded({extended: false});

dotenv.config({ path: './config/main.config.env'});

// Session Config
let sessionStore = new session.MemoryStore();
router.use(session({
    secret: process.env.COOKIE_SECRET,
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
}));

function requestTrace( req ) {
  var dateFormatted = new Date().toISOString().replace("T", " ");
  var h1 = '//****************************************************************************';
  console.log( `${h1}\n${dateFormatted}: ${req.method} ${req.protocol}://${req.headers["host"]}${req.originalUrl}` );
  console.log( `Headers:`)
  console.log(req.headers);
};

/** Create the issuance request payload for API */
issuanceConfigFile.authority = authConfig.IssuerAuthority;
issuanceConfigFile.registration.clientName = "SoumiOrg Credential Expert";
issuanceConfigFile.issuance.manifest = authConfig.CredentialManifest;


// if there is pin code in the config, but length is zero - remove it. It really shouldn't be there
if ( issuanceConfigFile.issuance.pin && issuanceConfigFile.issuance.pin.length == 0 ) {
  issuanceConfigFile.issuance.pin = null;
}

// Generate the api-key and populate the issuanceConfigFile
let apiKey = uuid.v4();
if(issuanceConfigFile.callback.headers) {
    issuanceConfigFile.callback.headers['api-key'] = apiKey;
};


/** Function to generate the PIN */
const genetatePin = (digits) => {
    let add = 1, max = 12 - add;
    max = Math.pow(10, digits + add);
    let min = max / 10;
    let number = Math.floor(Math.random() * (max - (min + 1))) + min;
    return("" + number).substring(add);
}

/** This route initiates the issuance of the verified credentials */

router.get('/issuance-request', async (req, res) => {
    //requestTrace(req);
    let id = req.session.id;
    let email = req.query.e;
    let fname = req.query.f;
    let lname = req.query.l;
    //console.log(req);
    console.log(`\nData: ${JSON.stringify(req.query)} \n`);
    console.log(`Email: ${email}\nFirst-Name: ${fname}\nLast-Name: ${lname}\n`);
    // Prepare a session state of 0
    sessionStore.get( id, (error, session) => {
        let sessionData = {
            "status": 0,
            "message": "Waiting for QR Code to be scanned!!"
        };
        if(session) {
            session.sessionData = sessionData;
            sessionStore.set(id, session);
        }
    });
    let accessToken = "";
    try {
        const result = await cca.acquireTokenByClientCredential(msalClientCredentialRequest);
        if(result) {
            accessToken = result.accessToken;
        }
    } catch {
        console.log(`Failed to get the access-token`);
        res.status(401).json({
            'eror': 'Could not acquire credentials to access your Azure Key Vault'
        });
        return;
    }
    console.log(`Access-Token: ${accessToken} \n`);

    // Update the callback_uri
    issuanceConfigFile.callback.url = `https://${req.hostname}/api/issuer/issuance-request-callback`;

    // Update the state parameter value 
    issuanceConfigFile.callback.state = id;

    // Use the generate PIN function to create a random pin everytime 
    // and add it to the issuance request
    if(issuanceConfigFile.issuance.pin) {
        issuanceConfigFile.issuance.pin.value = genetatePin(issuanceConfigFile.issuance.pin.length);
    };

    // Update the claims for the payload
    issuanceConfigFile.issuance.claims.given_name = fname;
    issuanceConfigFile.issuance.claims.family_name = lname;
    issuanceConfigFile.issuance.claims.email = email;

    console.log(`Issuance-Request-Payload: ${JSON.stringify(issuanceConfigFile)} \n`);
    console.log(`**************Calling the VC Issuance API**************\n`);

    let payload = JSON.stringify(issuanceConfigFile);
    const fetchOptions = {
        method: 'POST',
        body: payload,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length.toString(),
            'Authorization': `Bearer ${accessToken}`
        }
    };

    let issuance_api_endpoint = `https://beta.did.msidentity.com/v1.0/${authConfig.azTenantId}/verifiablecredentials/request`;
    const response = await fetch(issuance_api_endpoint, fetchOptions);
    let data = await response.json();
    data.id = id;
    if(issuanceConfigFile.issuance.pin) {
        data.pin = issuanceConfigFile.issuance.pin.value; // Add the pin to the response
    }

    res.status(200).json(data);
    console.log(`Data: ${JSON.stringify(data)}`);

    console.log(`\n********************API Call End*********************\n`);
});

/** This route is called by the VC Request API when the user scans a QR code 
 *  and presents a VC to the service
*/
router.post('/issuance-request-callback', parser, async(req, res) => {
    let body = '';
    req.on('data', (data) => {
        body += data;
    });
    req.on('end', () => {
        requestTrace(req);
        console.log(`Body: ${body}`);
        if(req.headers['api-key'] != apiKey) {
            res.status(401).json({
                'error': 'Invalid api-key'
            });
            return;
        }
        let issuanceResponse = JSON.parse(body.toString());
        let message = null;

        /** There are 2 different callbacks. 
         *  First if the QR code is scanned (or deeplink has been followed).
         *  Scanning the QR code makes Authenticator download the specific request from the server.
         *  The request will be deleted from the server immediately.
         *  That's why it is so important to capture this callback and relay this to the UI so the UI can hide.
         *  The QR code to prevent the user from scanning it twice (resulting in an error since the request is already deleted)
        */
       console.log(`Issuance-Response: ${JSON.stringify(issuanceResponse)}`);
       if(issuanceResponse.code == "request_retrieved") {
           message = "QR Code is scanned. Waiting for issuance to complete....";
       }
       if ( issuanceResponse.code == "issuance_successful" ) {
            message = "Credential successfully issued";
       }
       if ( issuanceResponse.code == "issuance_error" ) {
            message = issuanceResponse.error.message;
        }
        console.log(`Message: ${message}`);
        if(message != null) {
            sessionStore.get(issuanceResponse.status, (error, session) => {
                let sessionData = {
                    "status-2": issuanceResponse.code,
                    "message-2": message
                };
                session.sessionData = sessionData;
                sessionStore.set(issuanceResponse.state, session, (error) => {
                    res.send();
                });
            });
        }
        res.send();
    });
    res.send();
});

/** This route is called from the UI, polling for a response from the VC service
 *  When a callback is received at the PresentationCallback service the session will be updated.
 *  This route will respond with the status, which can be displayed on the UI, 
 *  if the QR Code was scanned and with the result of the presentation.
*/
router.get('/issuance-response', async (req, res) => {
    console.log(`Inside issuance-response`);
    let id = req.query.id;
    console.log(`ID: ${id}`);
    //requestTrace(req);
    sessionStore.get(id, (error, session) => {
        if(session && session.sessionData) {
            console.log(`Session: ${JSON.stringify(session)}`);
            console.log(`status-3: ${session.sessionData.status}, message-3: ${session.sessionData.message}`);
            res.status(200).json(session.sessionData);
        }
    });
});

module.exports = router;