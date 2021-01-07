const express = require('express')
const app = express()
const mysql = require('mysql')

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'onlyuser'
})

//the main middleware for the session
const session = require('express-session')
//save the session in my database
var MySQLStore = require('express-mysql-session')(session);
//configure my store for session configurarion
var sessionStore = new MySQLStore({}/* session store options */, connection);

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const PORT = process.env.PORT || 5000
const SALT_ = 10

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// requerimients for auth a authz
const passport = require('passport')
const passportLocal = require('passport-local').Strategy
const passportJWT = require('passport-jwt').Strategy
var cookieParser = require('cookie-parser')
var secret_A = 'myspecialsecret'
//para obtension de tokens del cliente
app.use(cookieParser(secret_A))

//express - session
app.use(session({
    secret : secret_A,
    resave : true,
    saveUninitialized : true,
    store : sessionStore
}))

//passport middlewares
app.use(passport.initialize())
//investigate how it works
app.use(passport.session())

//configuration strategies authentication
passport.use(new passportLocal(
    function (username, password, done) {
        console.log('localStrategy-',username,'-',password)
        connection.query(`select *from user_ where username_ = '${username}' limit 1 `,
            (error, result, fieldset) => {
                if (error) return done(error)
                if (result) {
                    bcrypt.genSalt(SALT_,
                        function(err, salt_) {
                            bcrypt.compare(password, result[0].password_,
                                function (err, result_) {
                                    console.log(result)
                                    console.log('local-result :', result_)
                                    if (result_ === true) return done(null, result[0])
                                    else return done(null, false)
                                })
                    })
                }
                else return done(null,false)
            }
        )
    }
))

passport.serializeUser(function (user, done) {
    done(null, user.idUser)
})

passport.deserializeUser(function (id, done) {
    connection.query(`select *from user_ where idUser = '${id}' `,
        (err, result, fieldset) => {
            console.log('deserialized',result)
            let userInfo = result[0]
            if (err) done(null,false)
            done(null,userInfo)
        })
})

//traditional login without express session and passport strategies
const login = (req,res) => {
    if(req.body === null || req.body === undefined) res.send({success : false})
    let {username,password} = req.body
    connection.query(`select *from user_ where username_ = '${username}' `,
    (error,result,fieldset) => {
        let data = result[0]
        var token = jwt.sign({data},secret_A)
        var decoded = jwt.verify(token,secret_A)
        console.log('decoded',decoded)

        if (error) res.send({error})
        console.log(result)
        if (result[0]){
            bcrypt.genSalt(SALT_,function(err,salt){
                bcrypt.hash(password,salt,function(err,hash){
                    bcrypt.compare(password,hash,function(err,result){
                        console.log(result)
                        if (result) res.send({ success: 'user finded', token })
                        else res.send({ response: 'no user with this parameters' })
                    })
                })
            })
        }
        else res.send({ success: false })
    })
}

const registerUser = (req, res) => {
    if (req.body === null || req.body === undefined) res.send({ response: false })
    const { username, password, fullname } = req.body
    console.log('register : ',username,'-',password,'-',fullname)
    bcrypt.genSalt(SALT_, function (error, salt) {
        bcrypt.hash(password, salt, function (err, hash) {
            connection.query(
                `insert into 
                user_(username_,password_,fullname) 
                values('${username}','${hash}','${fullname}')`,
                (err, result, fieldset) => {
                    if (err) res.send({ response: false })
                    res.send({ result })
                })
        })
    })
}

const logout = (req,res) => {
    req.logOut()
    res.send({signout : true})
}

const protectedRoute1 = (req,res) => {

}

const protectedRoute2 = (req,res) => {

}

//this route accepts a body with username - password
app.post('/signinNormal',login)
app.post('/signoutNormal',logout)
app.post('/registerNormal',registerUser)

//this routes are managed with express-session and passport
//i dont know exactly how cookies affect this algorithm, i need to learn more about this
app.post('/signin?:username?:password', passport.authenticate('local', { failureRedirect: '/login' }),
    function (req, res) {
        res.send(req.user)
})
app.post('/signout',(req,res)=>{
    req.logOut()
    res.send({hola : 'yes'})
})
// app.post('/register')

app.post('/protect/route1',(req,res,next)=>{
    console.log('cookie',req.cookies)
    console.log('isAuth',req.isAuthenticated())
    console.log('hola : ',req.user)
    console.log('session : ',req.session)
    res.send({ res: 'hola'})
    res.end()
})

app.post('/protect/route2',(req,res,next)=>{
    res.send(req.user)
})
// 
app.get('/',(req,res)=>{
    res.send({response : 'hola'})
})
app.get('/login',(req,res)=>{
    res.send({page : 'sopa do macaco, hay un error'})
})

app.listen(PORT,(err)=>{
    if (err) console.log(err)
    else console.log('server active')
})