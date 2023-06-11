import {Request, Response} from "express";
import {pool} from "../db";
import {getLang} from "../initExpress";
let parse = require('date-fns/parse')
let compareAsc = require('date-fns/compareAsc')
let add = require('date-fns/add')
let crypto = require('crypto')
// const { zonedTimeToUtc, utcToZonedTime, format } = require('date-fns-tz')

let express = require('express')
let router = express.Router();

type Fare = 'Economy' | 'Business' | 'Comfort'

type Flight = {
    flight_no: string,
    aircraft_code: string,
    days_of_week: number[],
    departure: Date|string,
    departure_utc: string
    arrival: Date|string,
    arrival_utc: string
    arrival_airport: string,
    departure_airport: string,
    fare_conditions: Fare[],
    arrival_city: {en: string, ru: string},
    departure_city: {en: string, ru: string},
    price: string
}

function time2Date(departure: string, arrival: string){
    let date = new Date()

    let departureStamp = parse(departure, "HH:mm:ss", date)
    let arrivalStamp = parse(arrival, "HH:mm:ss", date)

    if(compareAsc(departureStamp, arrivalStamp) == 1){
        arrivalStamp = add(arrivalStamp, {days: 1})
    }
    return [departureStamp, arrivalStamp]
}

//TODO: thread
router.get('/', async (req: Request, res: Response)=>{
    const pointA = req.query.point_a as string;
    const pointB = req.query.point_b as string;
    const departureDate = req.query.departure_date as string;
    const bookingClass = req.query.booking_class as Fare;
    const connections = parseInt(req.query.connections as string);
    const ddsplitted = departureDate.split('.').map((val)=>parseInt(val))
    const dow = (new Date(ddsplitted[2], ddsplitted[1], ddsplitted[0])).getUTCDay()

    // const queryAll = {
    //     name: 'initial-search-routes',
    //     text: `select * from schedule
    //            where $1 = ANY(fare_conditions) and
    //            $2 = ANY(days_of_week) and arrival_airport != $3 and $3 != arrival_city->>'${getLang()}'`,
    //     values: [bookingClass, dow, pointA]
    // }

    //INFO: сразу отсеиваются маршруты, у которых нет цены. Соответственно на выходе будет меньше.
    const queryAll = {
        name: 'initial-search-routes',
        text: ` select sch.flight_no,
                       aircraft_code,
                       days_of_week,
                       departure,
                       arrival,
                       arrival_airport,
                       departure_airport,
                       fare_conditions,
                       sch.arrival_city,
                       sch.departure_city,
                       price
                from schedule as sch
                         inner join (select flight_no, min(amount) as price
                                     from prices
                                     where fare_conditions = $1
                                     group by flight_no, fare_conditions) as p on sch.flight_no = p.flight_no
                where $1 = ANY (sch.fare_conditions)
                  and $2 = ANY (days_of_week)
                  and arrival_airport != $3 and $3 != arrival_city->>'${getLang()}'`,
        values: [bookingClass, dow, pointA]
    }
    let results:Flight[] = []
    try {
        results = ((await pool.query(queryAll)).rows)
        results.forEach(el=>{
            el.arrival_utc = el.arrival as string
            el.departure_utc = el.departure as string
            [el.departure, el.arrival] = time2Date(el.departure as string, el.arrival as string)
        })
    } catch(err){
        res.statusCode = 500
        res.json(err)
        return
    }

    function getConnections(chain: Flight[]){
        const last: Flight = chain[chain.length-1]
        // @ts-ignore
        if(last.arrival_airport == pointB || last.arrival_city[getLang()] == pointB){
            return chain
        }
        const previousDep = chain.map(el => el.departure_airport)
        const previousArrive = chain.map(el => el.arrival_airport)
        const available = results.filter((el)=>{
            return (el.departure > last.arrival) &&
                (el.departure_airport == last.arrival_airport) &&
                (!previousArrive.includes(el.arrival_airport)) &&
                (!previousDep.includes(el.arrival_airport))
        })
        if(available.length == 0)
            throw new Error("no els")
        else{
            let chains: any[] = []
            available.forEach(el=>{

                let nextChain = chain.concat([el])
                // @ts-ignore
                if(el.arrival_airport == pointB || el.arrival_city[getLang()] == pointB ){
                    chains.push(nextChain)
                } else {
                    if(nextChain.length == connections+1)
                        throw new Error("Limit of connections")
                    try {
                        chains.push(getConnections(nextChain))
                    } catch (e){

                    }
                }
            })
            if(chains.length == 0)
                throw new Error("no chains found")
            return chains;
        }
    }

    const firstChain = results.filter((el) => {
        // @ts-ignore
        return el.departure_airport == pointA || el.departure_city[getLang()] == pointA
    })

    let chains: any[] = []
    firstChain.forEach(el => {
        try{
            chains.push(getConnections([el]))
        } catch(e){

        }
    })
    function recFlat(arr: any[]){
        for (let idx = 0; idx < arr.length; idx++){
            const el = arr[idx];
            if(Array.isArray(el) && Array.isArray(el[0]) && Array.isArray(el[0][0])){
                arr[idx] = el.flat()
                idx = 0
            }
        }
    }

    recFlat(chains)
    chains = chains.flat().sort((a, b): number =>{
        if(!Array.isArray(a) && !Array.isArray(b))
            return 0
        if(!Array.isArray(a))
            return -1
        if(!Array.isArray(b))
            return 1
        if(a.length > b.length)
            return 1
        else if (a.length == b.length)
            return 0
        else return -1
    })

    // INFO: регрупнул и стандартизировал вывод, добавил цену
    let ids = chains.map((el)=>{
        if(Array.isArray(el)){
            let res:{
                price:number,
                chain:string[]
            } = {
                price: 0,
                chain: []
            }
            el.forEach((el1:Flight):void => {
                res.chain.push(el1.flight_no)
                res.price += parseFloat(el1.price)
            })
            return res
        } else {
            return {chain: [el.flight_no], price: parseFloat(el.price)}
        }
    })

    let flights = chains.flat()
    let uniqueFlights = [...new Set(flights)]
    let uniqueAirports = [...new Set(
        uniqueFlights.map(el => {
            return [el.departure_airport, el.arrival_airport]
        }).flat()
    )]

    for(let i = 0; i < uniqueAirports.length; i++){
        const query = {
            name: 'fetch-airports',
            text: `
            select 
                airport_name->>'${getLang()}' as name, 
                airport_code as code, 
                coordinates, 
                timezone 
            from airports_data where airport_code = $1`,
            values: [uniqueAirports[i]]
        }
        try{
            let airport = (await pool.query(query)).rows[0]
            airport.coordinates.lat = airport.coordinates.x
            airport.coordinates.lng = airport.coordinates.y
            delete airport.coordinates.x
            delete airport.coordinates.y
            uniqueAirports[i] = airport

        } catch (err) {
            res.statusCode = 500
            res.json(err)
        }
    }

    let send = {
        chains:ids,
        flights:uniqueFlights,
        airports: uniqueAirports
    }



    res.json(send)
})

//TODO: pool client, isolation
router.post('/booking', async (req: Request, res: Response)=>{
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

    function returnRouteWhere(indent:number){
        let str = ' ('
        for(let i = 0; i < route.length; i++){
            if(i!=0)
                str+=' or '
            str += `f.flight_no = $${i+indent+1}`
        }
        str += ') '
        return str
    }

    await pool.query("BEGIN")

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

    let flights =(await pool.query(queryFlights)).rows

    if(flights.length < route.length){
        res.statusCode = 500
        res.json({"message": "No flights on specified date for one of the flights!"})
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

    let seats = (await pool.query(queryAllSeats)).rows

    if(seats.length < route.length){
        res.statusCode = 500
        res.json({"message": "No seats with specified fare condition on one of the flights!"})
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

    let prices = (await pool.query(queryPrices)).rows

    if(prices.length < route.length){
        res.statusCode = 500
        res.json({"message": "No prices in database for some flight"})
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

    let booked = (await pool.query(queryBooked)).rows

    booked.forEach(el => {
        let totalSeatsInFlight = seats.filter(el1 => el1.flight_no == el.flight_no)
        if(parseInt(el.booked) >= parseInt(totalSeatsInFlight[0].total)){
            res.statusCode = 500
            res.json({"message": `No free seats for this fare condition in ${el.flight_no} ${el.flight_id}` })
            return
        }
    })

    const getRandBookingId = () => {return crypto.randomBytes(3).toString('hex')}

    let bookingId = getRandBookingId()
    const queryCheckId = {
        name: "get-id-booking",
        text: `
        select * from bookings where book_ref = $1
        `,
        values: [bookingId]
    }
    while (1){
        let reslen = (await pool.query(queryCheckId)).rows.length
        if(reslen!==0)
            bookingId = getRandBookingId()
        else
            break
    }

    const getRandUserId = () => {return `${crypto.randomInt(1000, 9999)} ${crypto.randomInt(100000, 999999)}`}

    let userID = getRandUserId()
    const queryCheckUserId = {
        name: "get-user-id-tickets",
        text: `
        select * from tickets where passenger_id = $1
        `,
        values: [userID]
    }
    while (1){
        let reslen = (await pool.query(queryCheckUserId)).rows.length
        if(reslen!==0)
            userID = getRandUserId()
        else
            break
    }

    const getRandTicketId = () => {return crypto.randomInt(1000000000000, 9999999999999)}

    let ticketId = getRandTicketId()
    const queryCheckTicketId = {
        name: "get-ticket-id",
        text: `
        select * from tickets where ticket_no = $1
        `,
        values: [ticketId]
    }
    while (1){
        let reslen = (await pool.query(queryCheckTicketId)).rows.length
        if(reslen!==0)
            ticketId = getRandTicketId()
        else
            break
    }

    const totalPrice = prices.map(el => Math.min(...el.prices)).reduce((a, c) => a+c, 0)
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
        text:`
        insert into tickets (ticket_no, book_ref, passenger_id, passenger_name, contact_data)
        values
        ($1, $2, $3, $4, $5) returning ticket_no;
        `,
        values: [ticketId,bookingId,userID,passenger_name,contact_data]
    }

    function generateTicketFlights(){
        let str = ""
        for (let i = 0; i < prices.length; i++){
            const el = prices[i];
            str += `('${ticketId}',${el.flight_id},'${fare_condition}',${Math.min(...el.prices)})\n`
            if(i != (prices.length-1))
                str+=','
        }
        str+=';'
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

    try {

        const insBookingRes = await pool.query(queryInsertBooking)
        const insTicketRes = await pool.query(queryInsertTicket)
        const insTicketFlight = await pool.query(queryInsertTicketFlight)

        // await db.query("ROLLBACK")
        await pool.query("COMMIT")
    } catch(err){
        await pool.query("ROLLBACK")
        res.statusCode = 500
        console.log(err)
        res.json(err)
        return
    }

    res.json([flights, seats, booked, prices, totalPrice, bookingId, userID, ticketId, generateTicketFlights()])
})

export default router
