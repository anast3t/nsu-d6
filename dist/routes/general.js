"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const initExpress_1 = require("../initExpress");
let express = require('express');
let router = express.Router();
let crypto = require('crypto');
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
router.post('/flights/checkin', async (req, res) => {
    const { passenger_id, flight_id, seat_number } = req.body;
    const queryCheckSeat = {
        name: "check-seat-number",
        text: `
        select *
        from boarding_passes
        where flight_id = $1 and seat_no = $2
        `,
        values: [flight_id, seat_number]
    };
    let seat_available = (await db_1.db.query(queryCheckSeat)).rows.length;
    if (seat_available !== 0) {
        res.statusCode = 500;
        res.json({ "message": "Seat is not free!" });
        return;
    }
    const queryFetchTicket = {
        name: "get-ticket",
        text: `
        select *
        from tickets
        where passenger_id = $1
        `,
        values: [passenger_id]
    };
    let ticket = (await db_1.db.query(queryFetchTicket)).rows;
    if (ticket.length === 0) {
        res.statusCode = 500;
        res.json({ "message": "User has no ticket!" });
        return;
    }
    let ticket_no = ticket[0].ticket_no;
    const generateBoardingID = () => { return crypto.randomInt(0, 1000); };
    let boardingId = generateBoardingID();
    const queryCheckBoardingID = {
        name: "get-id-boarding",
        text: `
        select * from boarding_passes where flight_id = $1 and boarding_no = $2
        `,
        values: [flight_id, boardingId]
    };
    while (1) {
        let reslen = (await db_1.db.query(queryCheckBoardingID)).rows.length;
        if (reslen !== 0)
            boardingId = generateBoardingID();
        else
            break;
    }
    const queryInsertBoardingPass = {
        name: "insert-boarding-pass",
        text: `
        insert into boarding_passes (ticket_no, flight_id, boarding_no, seat_no) 
        values
        ($1,$2,$3,$4);
        `,
        values: [ticket_no, flight_id, boardingId, seat_number]
    };
    try {
        await db_1.db.query("BEGIN");
        const insBoardingPassRes = db_1.db.query(queryInsertBoardingPass);
        await db_1.db.query("COMMIT");
    }
    catch (err) {
        await db_1.db.query("ROLLBACK");
        res.statusCode = 500;
        console.log(err);
        res.json(err);
        return;
    }
    res.json([boardingId]);
});
exports.default = router;
