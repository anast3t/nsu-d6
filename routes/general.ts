import {Request, Response} from "express";
import {pool} from "../db";
import {getLang, getTime} from "../initExpress";
let express = require('express')
let router = express.Router();
let crypto = require('crypto')

router.get('/', (req: Request, res: Response) => {
    res.send("GOT LANG = " + getLang());
});

router.get('/heavy', (req: Request, res: Response)=> {
    const time = parseInt(req.query.time as string)
    const start = Date.now()
    const totalStarted = getTime()
    setTimeout(()=> {
        const end = Date.now()
        res.json({time: (end-start)/1000, totalStart: totalStarted})
    }, time)
})

router.get('/cities', (req: Request, res: Response)=>{
    const text = `select city->>'${getLang()}' as name, coordinates, timezone from airports_data` as string

    pool.query(text).then((qres)=>{
        let result = qres.rows
        result.forEach(el => {
            el.coordinates.lng = el.coordinates.x
            el.coordinates.lat = el.coordinates.y
            delete el.coordinates.x
            delete el.coordinates.y

        })
        res.json(result)
    })
})

//TODO: pool client, isolation
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

    let seat_available =(await pool.query(queryCheckSeat)).rows.length

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

    let ticket =(await pool.query(queryFetchTicket)).rows

    if(ticket.length === 0){
        res.statusCode = 500
        res.json({"message": "User has no ticket!"})
        return
    }

    let ticket_no = ticket[0].ticket_no as string

    const queryBoardingPrice = {
        name: "get-price-flightno-fare",
        text: `
        select p.amount, f.flight_no, tf.fare_conditions
        from tickets
            inner join ticket_flights tf on tickets.ticket_no = tf.ticket_no
            inner join flights f on f.flight_id = tf.flight_id
            inner join prices p on f.aircraft_code = p.aircraft_code and p.flight_no = f.flight_no
        where passenger_id = $1 and f.flight_id = $2 and $3 = ANY(p.seat_arr);
        `,
        values: [passenger_id, flight_id, seat_number]
    }

    let dopPrice:any[]|number = (await pool.query(queryBoardingPrice)).rows

    if(dopPrice.length === 0){
        res.statusCode = 500
        res.json({"message": "DB has no price!"})
        return
    }

    let flight_no = dopPrice[0].flight_no
    let fare = dopPrice[0].fare_conditions
    dopPrice = dopPrice[0].amount

    const queryStockPrice = {
        name: "get-stock-price",
        text: `
        select f.flight_no, array_agg(distinct p.amount) as prices
        from flights as f
                 inner join prices p on f.flight_no = p.flight_no
        where fare_conditions = $1 and f.flight_no = $2
        group by f.flight_no
        `,
        values: [fare, flight_no]
    }

    let stockPrice:any[]|number = (await pool.query(queryStockPrice)).rows

    if(stockPrice.length === 0){
        res.statusCode = 500
        res.json({"message": "DB has no stock price!"})
        return
    }

    stockPrice = Math.min(...stockPrice[0].prices)

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
        let reslen = (await pool.query(queryCheckBoardingID)).rows.length
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

    //проверить полёт
    try {
        await pool.query("BEGIN")
        const insBoardingPassRes = pool.query(queryInsertBoardingPass)
        await pool.query("COMMIT")
    } catch(err){
        await pool.query("ROLLBACK")
        res.statusCode = 500
        console.log(err)
        res.json(err)
        return
    }

    res.json([boardingId, (dopPrice as number - stockPrice as number)])
})

export default router

