import {Request, Response} from "express";
import {db} from "../db";
import {getLang} from "../initExpress";
let express = require('express')
let router = express.Router();
let crypto = require('crypto')

router.get('/', (req: Request, res: Response) => {
    res.send("GOT LANG = " + getLang());
});

router.get('/cities', (req: Request, res: Response)=>{
    const text = `select city->>'${getLang()}' as name, coordinates, timezone from airports_data` as string

    db.query(text).then((qres)=>{
        let result = qres.rows
        res.json(result)
    })
})

router.post('/flights/checkin', async (req: Request, res: Response)=>{
    type Body = {
        passenger_id: string, //здесь МОЖНО передавать имя+мыло+телефон, но объективно правильней именно id
        flight_id: number,
        seat_number:string
    }

    const {
        passenger_id,
        flight_id,
        seat_number
    } = req.body as Body

    const queryCheckSeat = {
        name: "check-seat-number",
        text: `
        select *
        from boarding_passes
        where flight_id = $1 and seat_no = $2
        `,
        values: [flight_id, seat_number]
    }

    let seat_available =(await db.query(queryCheckSeat)).rows.length

    if(seat_available !== 0){
        res.statusCode = 500
        res.json({"message": "Seat is not free!"})
        return
    }

    const queryFetchTicket = {
        name: "get-ticket",
        text: `
        select *
        from tickets
        where passenger_id = $1
        `,
        values: [passenger_id]
    }

    let ticket =(await db.query(queryFetchTicket)).rows

    if(ticket.length === 0){
        res.statusCode = 500
        res.json({"message": "User has no ticket!"})
        return
    }

    let ticket_no = ticket[0].ticket_no as string

    const generateBoardingID = () => {return crypto.randomInt(0, 1000)}
    let boardingId = generateBoardingID()

    const queryCheckBoardingID  = {
        name: "get-id-boarding",
        text: `
        select * from boarding_passes where flight_id = $1 and boarding_no = $2
        `,
        values: [flight_id, boardingId]
    }

    while (1){
        let reslen = (await db.query(queryCheckBoardingID)).rows.length
        if(reslen!==0)
            boardingId = generateBoardingID()
        else
            break
    }

    const queryInsertBoardingPass = {
        name: "insert-boarding-pass",
        text: `
        insert into boarding_passes (ticket_no, flight_id, boarding_no, seat_no) 
        values
        ($1,$2,$3,$4);
        `,
        values:[ticket_no, flight_id, boardingId, seat_number]
    }

    try {
        await db.query("BEGIN")
        const insBoardingPassRes = db.query(queryInsertBoardingPass)
        await db.query("COMMIT")
    } catch(err){
        await db.query("ROLLBACK")
        res.statusCode = 500
        console.log(err)
        res.json(err)
        return
    }

    res.json([boardingId])
})

export default router

