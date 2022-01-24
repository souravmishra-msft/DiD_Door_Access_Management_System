const router = require('express').Router();
const authConfig = require('../config/config.json');








// router.use((req, res, next) => {
//     res.header("Access-Control-Allow-Origin", "*");
//     res.header("Access-Control-Allow-Headers", "Authorization, Origin, X-Requested-With, Content-Type, Accept");
// });



router.get('/', (req, res) => {
    res.render('index');
});

router.get('/details', (req, res) => {
    res.render('userDetails');
});

router.get('/issuer', (req, res) => {
    res.render('issuer');
});

router.get('/verifier', (req, res) => {
    res.render('verifier');
});

module.exports = router;