"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const initExpress_1 = require("../initExpress");
let express = require('express');
let router = express.Router();
router.get('/', (req, res) => {
    res.send("GOT LANG = " + (0, initExpress_1.getLang)());
});
router.get('/cities', (req, res) => {
    const text = `select city->>'${(0, initExpress_1.getLang)()}' as name, coordinates, timezone from airports_data`;
    db_1.db.query(text).then((qres) => {
        let result = qres.rows;
        res.json(result);
    });
});
router.post('/flights/checkin', (req, res) => {
});
exports.default = router;
