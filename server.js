const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const env = require('dotenv').config();
const cors = require('cors')
const moment = require('moment');
moment().format();
const mongoose = require('mongoose')
const db = mongoose.connection;

mongoose.connect(process.env.MONGO, {useNewUrlParser: true, poolSize: 4, useUnifiedTopology: true});

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

db.on('error', console.error.bind(console, 'connection error:'));
db.once('openUri', function () {
  // we're connected!
});

//Schemas
const userschema = new mongoose.Schema({
  username : { type: String, unique: true},
  exercise : [{
  description: String,
  duration: Number,
  date: String
  }]
});

const user = mongoose.model('user', userschema);

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post("/api/exercise/new-user", async (req,res) => {
//Create a user   
  let users = new user({"username" : req.body.username})

  let userfind = await user.findOne({"username": req.body.username }, (err,doc) => {
       if(err) {
         console.log(err)
       } else {
         if (doc !== null) {
           //If username already exists display error
           res.json({
             "Error": "Username already taken, please choose a new one"
           });
         } 
       }
  });
  
  if(userfind == null) {
    let toSave = users.save((err,doc) => {
        if(err) {
          console.log(err)
        } else {
          res.json({
            username: doc.username,
            _id: doc._id
          });
        }
    });
  }
});

//Add exercise
app.post("/api/exercise/add", (req,res) => {

  let currentDate = Date(); 
   
  if(req.body.date == " ") {
    currentDate = moment(currentDate).toString();
  } else {
    currentDate = req.body.date;
    currentDate = moment(currentDate).toString(); 
  }
//Check date format, display error if invalid
  if (currentDate == "Invalid date") {
    res.json({
      date: "Incorrect Format, It must be YYYY-MM-DD or MM-DD-YYYY"
    })
  } else {
  let addex = [{
    _id: mongoose.Types.ObjectId(req.body.userId),
    description: req.body.description,
    duration: req.body.duration,
    date: currentDate
  }]
//Add an exercise
  let addexercise = user.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(req.body.userId)}, { $push : { exercise : addex } },(err,doc) => {
    if(err) {
      console.log(err)
    } else {
      addex[0].username = doc.username;
      res.json({
        "_id": addex[0]._id,
        "username": addex[0].username,
        "description": addex[0].description,
        "duration": addex[0].duration,
        "date": addex[0].date
      })
    } 
  }); 
 }
});

app.get("/api/exercise/log", async (req, res) => {
//Display log of users  
  let id = req.query.userid;
  let from = req.query.from;
  let to = req.query.to;
  let limits = req.query.limit;
//Check if from and to present, if not display only user 
  if(from == null && to == null ) {
    let log = await user.findOne({ _id: mongoose.Types.ObjectId(id) }, (err, doc) => {
      if(err) {
        res.json({
          error : err
        })
      } else {
      res.json({
        userId: doc._id,
        username: doc.username,
        count: doc.exercise.length,
        log: doc.exercise
      })
     }
    });
  } else {
//Find via Object Id     
  let displayLog = await user.findById({_id: mongoose.Types.ObjectId(id)},(err,doc) => {
  if(err) {
    res.json({
      err: err
    })
  } else { 
 
  let len = doc.exercise.length
  
  //Parses and checks the date
  from = moment(from).toString();
  to = moment(to).toString();
    if ( to == "Invalid date" || from == "Invalid date" ) {
      res.json({
        "From/to": "Incorrect from or to format, use YYYY/MM/DD"
      })
    } else {
      from = Date.parse(from);
      to = Date.parse(to);  
      var logs = [];
      //Loops through the exercise array
      for(let i = 0;i < len;i++) {
        let logTime = Date.parse(doc.exercise[i].date)
        if ((from < logTime) && (to > logTime)) {
          logs.push(doc.exercise[i]);
        } 
      }
      //Sorts the exercise array, Recent will come first
      logs.sort((i,j) => {
        let firstDate = new Date(i.date);
        let nextDate = new Date(j.date);
        return firstDate + nextDate;
      });
      //If limit option present, limits array to recent
      if(limits !== undefined) {
        logs = logs.splice(0, limits);
      }   
        res.json({
            "All exercises": logs
          })
      }
  }  
  });
 }
});

app.get("/api/users", async (req,res) => {
//List of all Users   
   let userToShow =  await user.find((err, doc) => {
    if(err) {
      console.log(err)
    } else {
       let docs = []
      for (let i = 0; i < doc.length; i++) {
        docs.push({ "username": doc[i].username, "_id": doc[i].id})
       }
       res.send(docs);
    }
  })
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: 'not found' })
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
