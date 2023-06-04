"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let express = require('express');
let router = express.Router();
router.get('/', (req, res) => {
    res.send('Express + TypeScript Server');
});
exports.default = router;
