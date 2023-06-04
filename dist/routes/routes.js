"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let express = require('express');
let router = express.Router();
router.get('/', (req, res) => {
    const pointA = req.query.point_a;
    const pointB = req.query.point_b;
    const departureDate = req.query.departure_date;
    const bookingClass = req.query.booking_class;
    const connections = req.query.connections;
});
router.post('/booking', (req, res) => {
});
exports.default = router;
