const email1 = document.getElementById('email');
const fname1 = document.getElementById('fname');
const lname1 = document.getElementById('lname');
const idIssueBtn = document.getElementById('idIssue-btn');

let enableSubmit = () => {
    let inputs = document.querySelectorAll("#email, #fname, #lname");

    let isValid = true;

    for(let i = 0; i < inputs.length; i++) {
        let changedInput = inputs[i];
        if(changedInput.value.trim() === "" || changedInput.value === null) {
            isValid = false;
            break;
        }
    }
    idIssueBtn.disabled = !isValid;
}

idIssueBtn.addEventListener('click', () => {
    console.log(`Email: ${email1.value}`);
    console.log(`First-Name: ${fname1.value}`);
    console.log(`Last-Name: ${lname1.value}`);
    location.href = "/issuer?email=" + email1.value + "&fname=" + fname1.value + "&lname=" + lname1.value;
});