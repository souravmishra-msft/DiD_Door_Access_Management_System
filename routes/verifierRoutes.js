const router = require('express').Router();
const dotenv = require('dotenv');
const session = require('express-session');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const uuid = require('uuid');
const { cca, msalClientCredentialRequest } = require('../Auth/msalAuth');
const parser = bodyParser.urlencoded({extended: false});
const authConfig = require('../config/config.json');
const presentationConfig = require('../config/presentation_required_config.json');

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

/** Setup the presentation request payload */

presentationConfig.registration.clientName = "SoumiOrg VC Verifier";
presentationConfig.authority = authConfig.VerifierAuthority;
presentationConfig.presentation.requestedCredentials[0].acceptedIssuers[0] = authConfig.IssuerAuthority;

let apiKey = uuid.v4();
if(presentationConfig.callback.headers) {
    presentationConfig.callback.headers['api-key'] = apiKey;
};

/** This endpoint is called from the UI to initiate the presentation to the VC */
router.get('/presentation-request', async (req, res) => {
    //requestTrace(req);
    let id = req.session.id;

    // Prepare a session state of 0
    sessionStore.get(id, (error, session) => {
        let sessionData = {
            "status": 0,
            "message": "Waiting for the Verifier QR Code to be scanned."
        };
        if(session) {
            session.sessionData = sessionData;
            sessionStore.set(id, session);
        }
    });
    // Get an Access-Token
    let accessToken = "";
    try {
        const result = await cca.acquireTokenByClientCredential(msalClientCredentialRequest);
        if(result) {
            accessToken = result.accessToken;
        }
    } catch {
        console.log( "Failed to get access token" );
        res.status(401).json({
            'error': 'Could not acquire credentials to access your Azure Key Vault'
            });  
        return; 
    }
    console.log( `\nAccess-Token: ${accessToken} \n` );
    presentationConfig.callback.url = `https://${req.hostname}/api/verifier/presentation-request-callback`;
    presentationConfig.callback.state = id;

    let payload = JSON.stringify(presentationConfig);
    console.log(`PresentationRequest: ${payload} \n`);

    console.log(`**************Calling the VC Presentation API**************\n`);
    
    const fetchOptions = {
        method: 'POST',
        body: payload,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length.toString(),
            'Authorization': `Bearer ${accessToken}`
        }
    };

    let presentation_api_endpoint = `https://beta.did.msidentity.com/v1.0/${authConfig.azTenantId}/verifiablecredentials/request`;
    const response = await fetch(presentation_api_endpoint, fetchOptions);
    let data = await response.json();
    data.id = id;
    console.log(`Response from Verifier API Response: ${JSON.stringify(data)}`);
    res.status(200).json(data);
    
    console.log(`\n********************API Call End*********************\n`);
});


/** This endpoint is called by the VC Request API when the user scans a QR Code and 
 *  presents a VC to the service
 */
router.post('/presentation-request-callback', parser, async (req, res) => {
    let body = '';
    req.on('data', (data) => {
        body += data;
    });
    req.on('end', () => {
        requestTrace(req);
        console.log(`Body: ${body}`);
        if(req.headers['api-key'] != apiKey) {
            res.status(401).json({
                'error': 'Invalid Api-Key'
            });
            return;
        }

        let presentationResponse = JSON.parse(body.toString());

        if ( presentationResponse.code == "request_retrieved" ) {
            sessionStore.get( presentationResponse.state, (error, session) => {
                var cacheData = {
                    "status": presentationResponse.code,
                    "message": "QR Code is scanned. Waiting for validation..."
                };
                session.sessionData = cacheData;
                sessionStore.set( presentationResponse.state, session, (error) => {
                    res.send();
                });
            });      
        }

        if ( presentationResponse.code == "presentation_verified" ) {
            sessionStore.get(presentationResponse.state, (error, session) => {
                var cacheData = {
                    "status": presentationResponse.code,
                    "message": "Presentation received",
                    "payload": presentationResponse.issuers,
                    "subject": presentationResponse.subject,
                    "firstName": presentationResponse.issuers[0].claims.firstName,
                    "lastName": presentationResponse.issuers[0].claims.lastName,
                    "presentationResponse": presentationResponse
                };
                session.sessionData = cacheData;
                sessionStore.set( presentationResponse.state, session, (error) => {
                res.send();
                });
            });      
        }   
    });
    res.send();
});


router.get('/presentation-response', async (req, res) => {
    let id = req.query.id;
    //requestTrace(req);
    sessionStore.get(id, (error, session) => {
        console.log(`Session in PresentationResponse: ${JSON.stringify(req.session)}`);
        if(session && session.sessionData) {
            console.log(`status-3: ${session.sessionData.status}, message: ${session.sessionData.message}`);
            if(session.sessionData.status == "presentation_verified"){
                delete session.sessionData.presentationResponse; // Browser dont need this data
            }
            res.status(200).json(session.sessionData);
        }
    });
});









module.exports = router;