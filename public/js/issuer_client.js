const signIn = document.getElementById('sign-in');

let email = '';
let fname = '';
let lname = '';

let qrcode_issuer = new QRCode("qrcode", { width: 200, height: 200 });
let respIssuanceReq = null;

window.onload = () => {
    let url = document.location.href;
    let data = url.split('?')[1].split('&');
    console.log(data);
    email = data[0].split('=')[1];
    fname = data[1].split('=')[1];
    lname = data[2].split('=')[1];
    //console.log(`Email: ${email}\nFirst-Name: ${fname}\nLast-Name: ${lname}`); 
    
    signIn.addEventListener('click', () => {
        fetch(`/api/issuer/issuance-request?e=${email}&f=${fname}&l=${lname}`)
        .then((response) => {
            response.text()
            .catch(error => document.getElementById("message").innerHTML = error)
            .then((message) => {
                respIssuanceReq = JSON.parse(message);
                if ( /Android/i.test(navigator.userAgent) ) {
                    console.log(`Android device! Using deep link (${respIssuanceReq.url}).`);
                    window.location.href = respIssuanceReq.url; setTimeout(() => {
                    window.location.href = "https://play.google.com/store/apps/details?id=com.azure.authenticator"; }, 2000);
                } else if (/iPhone/i.test(navigator.userAgent)) {
                    console.log(`iOS device! Using deep link (${respIssuanceReq.url}).`);
                    window.location.replace(respIssuanceReq.url);
                } else {
                    console.log(`Not Android or IOS. Generating QR code encoded with ${message}`);
                    console.log(`Response: ${JSON.stringify(respIssuanceReq)}`);
                    qrcode_issuer.makeCode(respIssuanceReq.url);
                    document.getElementById('sign-in').style.display = "none";
                    document.getElementById('qrText').style.display = "block";
                    if (respIssuanceReq.pin) {
                        document.getElementById('pinCodeText').innerHTML = "Pin code: " + respIssuanceReq.pin;
                        document.getElementById('pinCodeText').style.display = "block";
                    }
                }
            }).catch(error => { console.log(error.message); });
        }).catch(error => { console.log(error.message); });
        let checkStatus = setInterval(() => {
            fetch(`/api/issuer/issuance-response?id=${respIssuanceReq.id}`)
                .then(response => response.text())
                .catch(error => document.getElementById("message").innerHTML = error)
                .then(response => {
                    if(response.length > 0) {
                        console.log(response);
                        responseMessage = JSON.parse(response);

                        // Now the QR Code is scanned. Display the PIN (if applicable)
                        if(responseMessage.status == 'request_retrieved') {
                            document.getElementById('message-wrapper').style.display = "block";
                            document.getElementById('qrText').style.display = "none";
                            document.getElementById('qrcode').style.display = "none";
                            if(responseMessage.pin) {
                                document.getElementById('pinCodeText').style.display = "visible";
                            }                
                            document.getElementById('message').innerHTML = responseMessage.message;
                        }
                        if(responseMessage.status == 'issuance_successful') {
                            document.getElementById('pinCodeText').style.display = "none";
                            document.getElementById('message').innerHTML = responseMessage.message;
                            clearInterval(checkStatus);
                        }
                        if(responseMessage == 'issuance_failed') {
                            document.getElementById('pinCodeText').style.display = "none";
                            document.getElementById('message').innerHTML = "Issuance error occured. Please refresh the page and try again.";
                            document.getElementById('payload').innerHTML = "Payload: " + responseMessage.payload;
                            clearInterval(checkStatus);
                        }
                    }
                });
        }, 3000);

    });
}




