import {Request, Response} from "express";
import {pool} from "../db";
import path from "path";

let crypto = require('crypto')
const {Worker} = require("node:worker_threads")

let express = require('express')
let router = express.Router();

type Fare = 'Economy' | 'Business' | 'Comfort'

router.get('/', async (req: Request, res: Response) => {
    //INFO: сгрузил на отдельный воркер-тред
    let reqData = {
        query: req.query
    }
    let workerPath = path.join(__dirname, '..', 'workers', 'routes.js')
    console.log(workerPath)
    let worker = new Worker(workerPath, {workerData: reqData})
    worker.on('message', (send: any) => {
        res.json(send)
    })
    worker.on('error', (err: any) => {
        res.statusCode = 500
        res.json(err)
    })
})

router.post('/booking', async (req: Request, res: Response) => {
    type Body = {
        passenger_name: string,
        contact_data: {
            email: string,
            phone: string
        },
        fare_condition: Fare,
        date: string,
        route: string[]
    }

    const {
        passenger_name,
        contact_data,
        fare_condition,
        route,
        date
    } = req.body as Body

    function returnRouteWhere(indent: number) {
        let str = ' ('
        for (let i = 0; i < route.length; i++) {
            if (i != 0)
                str += ' or '
            str += `f.flight_no = $${i + indent + 1}`
        }
        str += ') '
        return str
    }

    //INFO: нельзя проводить транзакцию через разные подключения, поэтому надо выделить один коннект
    const client = await pool.connect()

    try {
        //INFO: Добавил изоляцию
        await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE")

        const queryFlights = {
            name: "get-route-flights",
            text: `
        select flight_id,
               flight_no,
               scheduled_departure,
               scheduled_arrival,
               departure_airport,
               arrival_airport
        from flights as f
        where ${returnRouteWhere(1)}
          and scheduled_departure::date = $1
          and status = 'Scheduled'
        `,
            values: [date].concat(route)
        }

        let flights = (await client.query(queryFlights)).rows

        if (flights.length < route.length) {
            res.statusCode = 500
            res.json({"message": "No flights on specified date for one of the flights!"})
            client.release()
            return
        }

        const queryAllSeats = {
            name: "get-seats-number-on-flights",
            text: `
        select f.aircraft_code,
               f.flight_id,
               f.flight_no,
               count(s.seat_no) as total
        from flights as f
            inner join seats s on f.aircraft_code = s.aircraft_code
        where ${returnRouteWhere(2)}
          and scheduled_departure::date = $1
          and status = 'Scheduled'
          and fare_conditions = $2
        group by f.flight_id, f.aircraft_code, f.flight_no
        `,
            values: [date, fare_condition].concat(route)
        }

        let seats = (await client.query(queryAllSeats)).rows

        if (seats.length < route.length) {
            res.statusCode = 500
            res.json({"message": "No seats with specified fare condition on one of the flights!"})
            client.release()
            return
        }

        let queryPrices = {
            name: "get-prices-on-flights",
            text: `
        select f.aircraft_code,
               f.flight_no,
               f.flight_id,
               array_agg(p.amount) as prices
        from flights as f
                 inner join prices p on f.flight_no = p.flight_no
        where ${returnRouteWhere(2)}
          and scheduled_departure::date = $1
          and status = 'Scheduled'
          and fare_conditions = $2
        group by f.flight_no, f.aircraft_code, f.flight_id;
        `,
            values: [date, fare_condition].concat(route)
        }

        let prices = (await client.query(queryPrices)).rows

        if (prices.length < route.length) {
            res.statusCode = 500
            res.json({"message": "No prices in database for some flight"})
            client.release()
            return
        }

        const queryBooked = {
            name: "get-booked-on-flights",
            text: `
        select f.flight_id,
               f.flight_no,
               count(tf.fare_conditions) as booked
        from flights as f
            inner join ticket_flights tf on f.flight_id = tf.flight_id
        where ${returnRouteWhere(2)}
          and scheduled_departure::date = $1
          and status = 'Scheduled'
          and fare_conditions = $2
        group by f.flight_id, f.flight_no
        `,
            values: [date, fare_condition].concat(route)
        }

        let booked = (await client.query(queryBooked)).rows

        booked.forEach(el => {
            let totalSeatsInFlight = seats.filter(el1 => el1.flight_no == el.flight_no)
            if (parseInt(el.booked) >= parseInt(totalSeatsInFlight[0].total)) {
                res.statusCode = 500
                res.json({"message": `No free seats for this fare condition in ${el.flight_no} ${el.flight_id}`})
                return
            }
        })

        const getRandBookingId = () => {
            return crypto.randomBytes(3).toString('hex')
        }

        let bookingId = getRandBookingId()
        const queryCheckId = {
            name: "get-id-booking",
            text: `
        select * from bookings where book_ref = $1
        `,
            values: [bookingId]
        }
        while (1) {
            let reslen = (await client.query(queryCheckId)).rows.length
            if (reslen !== 0)
                bookingId = getRandBookingId()
            else
                break
        }

        const getRandUserId = () => {
            return `${crypto.randomInt(1000, 9999)} ${crypto.randomInt(100000, 999999)}`
        }

        let userID = getRandUserId()
        const queryCheckUserId = {
            name: "get-user-id-tickets",
            text: `
        select * from tickets where passenger_id = $1
        `,
            values: [userID]
        }
        while (1) {
            let reslen = (await client.query(queryCheckUserId)).rows.length
            if (reslen !== 0)
                userID = getRandUserId()
            else
                break
        }

        const getRandTicketId = () => {
            return crypto.randomInt(1000000000000, 9999999999999)
        }

        let ticketId = getRandTicketId()
        const queryCheckTicketId = {
            name: "get-ticket-id",
            text: `
        select * from tickets where ticket_no = $1
        `,
            values: [ticketId]
        }
        while (1) {
            let reslen = (await client.query(queryCheckTicketId)).rows.length
            if (reslen !== 0)
                ticketId = getRandTicketId()
            else
                break
        }

        const totalPrice = prices.map(el => Math.min(...el.prices)).reduce((a, c) => a + c, 0)
        const currentTime = new Date()

        const queryInsertBooking = {
            name: "insert-booking",
            text: `
        insert into bookings (book_ref, book_date, total_amount) values ($1,$2,$3) returning book_ref;
        `,
            values: [bookingId, currentTime, totalPrice]
        }

        const queryInsertTicket = {
            name: "insert-ticket",
            text: `
        insert into tickets (ticket_no, book_ref, passenger_id, passenger_name, contact_data)
        values
        ($1, $2, $3, $4, $5) returning ticket_no;
        `,
            values: [ticketId, bookingId, userID, passenger_name, contact_data]
        }

        function generateTicketFlights() {
            let str = ""
            for (let i = 0; i < prices.length; i++) {
                const el = prices[i];
                str += `('${ticketId}',${el.flight_id},'${fare_condition}',${Math.min(...el.prices)})\n`
                if (i != (prices.length - 1))
                    str += ','
            }
            str += ';'
            return str
        }

        const queryInsertTicketFlight = {
            name: "insert-ticket-flight",
            text: `
        insert into ticket_flights (ticket_no, flight_id, fare_conditions, amount)
        values
        ${generateTicketFlights()}
        `,
            values: []
        }


        const insBookingRes = await client.query(queryInsertBooking)
        const insTicketRes = await client.query(queryInsertTicket)
        const insTicketFlight = await client.query(queryInsertTicketFlight)

        // await client.query("ROLLBACK")
        await client.query("COMMIT")

        res.json({flights, seats, booked, prices, totalPrice, bookingId, userID, ticketId})
    } catch (err) {
        await client.query("ROLLBACK")
        res.statusCode = 500
        console.log(err)
        res.json(err)
    }
    client.release()
})

export default router
