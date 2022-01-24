const path = require('path');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ejs = require('ejs');
const expressLayout = require('express-ejs-layouts');


const webRoutes = require('./routes/webRoutes');
const issuerRoutes = require('./routes/issuerRoutes');
const verifierRoutes = require('./routes/verifierRoutes');

dotenv.config({ path: './config/main.config.env'});

const app = express();
const PORT = process.env.PORT;



app.use(expressLayout);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '/public'))); // define the assets
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');



/** Routes */
app.use('/', webRoutes);
app.use('/api/issuer', issuerRoutes);
app.use('/api/verifier', verifierRoutes);


app.listen(PORT, () => {
  console.log(`App is running on http://localhost:${PORT}`);
});
 