const verify = document.getElementById('verify');

let qrcode_verifier = new QRCode("qrcode", { width: 200, height: 200 });
let respPresentationReq = null;

verify.addEventListener('click', () => {
    fetch('/api/verifier/presentation-request')
    .then((response) => {
        response.text()
        .catch(error => document.getElementById("message").innerHTML = error)
        .then((message) => {
            respPresentationReq = JSON.parse(message);
            if(/Android/i.test(navigator.userAgent)) {
                console.log(`Android device! Using deep link (${respPresentationReq.url}).`);
                window.location.href = respPresentationReq.url; setTimeout(function () {
                window.location.href = "https://play.google.com/store/apps/details?id=com.azure.authenticator"; }, 2000);
            } else if (/iPhone/i.test(navigator.userAgent)) {
                console.log(`iOS device! Using deep link (${respPresentationReq.url}).`);
                window.location.replace(respPresentationReq.url); 
            } else {
                console.log(`Not Android or IOS. Generating QR code encoded with ${message}`);
                qrcode_verifier.makeCode(respPresentationReq.url);
                document.getElementById('sign-in').style.visibility = "hidden";
                document.getElementById('qrText').style.display = "block";
            }
        }).catch(error => { console.log(error.message); });
    }).catch(error => { console.log(error.message); });
    let checkStatus = setInterval(() => {
        fetch(`api/verifier/presentation-response?id=${respPresentationReq.id}`)
        .then(response => response.text())
        .catch(error => document.getElementById("message").innerHTML = error)
        .then(response => {
            if(response.length > 0) {
                console.log(`Response-Verifier: ${response}`);
                responseMessage = JSON.parse(response);
                console.log(`Response-Message: ${JSON.stringify(responseMessage)}`);
                // Now the QR Code is scanned.
                if (responseMessage.status == 'request_retrieved') {
                    document.getElementById('message-wraper').style.display = "block";
                    document.getElementById('qrText').style.display = "none";
                    document.getElementById('qrcode').style.display = "none";
                    document.getElementById('message').innerHTML = responseMessage.message;
                }
                if (responseMessage.status == 'presentation_verified') {
                    document.getElementById('message').innerHTML = responseMessage.message;
                    document.getElementById('payload').innerHTML = "Payload: " + JSON.stringify(responseMessage.payload);
                    document.getElementById('subject').innerHTML = responseMessage.firstName +" " + responseMessage.lastName +" is a Verifiable Credential Expert";
                    clearInterval(checkStatus);
                }
            }
        });
    }, 3000);
});