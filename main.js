const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
app.use(express.json());

const dbName = 'kvc-database';
const chatCollectionName = 'messages';
const mongoURI = 'mongodb+srv://vijaykchandan:vijay123@cluster0.iyxaduc.mongodb.net/';
var users = {};
var email = '';
var messageInfo = {
  senderemail: '',
  receiveremail: ''
};
var senderemail = '';
var receiveremail = '';
app.use(cors());
// Generate OTP function
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000);
}

// Email sending route
app.post('/sendOTP', async (req, res) => {
 console.log(req.body, 'bodyyy')
  email  = req.body.email;
  users[email] = generateOTP(); // Generate OTP

  // Create a nodemailer transporter
  const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
          user: 'vijaykchandan@gmail.com', // Your Gmail email
          pass: 'rkbt inyf ncsb fohm' // Your Gmail password
      }
  });

  // Email options
  const mailOptions = {
      from: 'vijaykchandan@gmail.com',
      to: email,
      subject: 'Your OTP for Login',
      text: `Your OTP is ${users[email]}`
  };
let otp  = users[email];
  try {
      // Send email
      await transporter.sendMail(mailOptions);
      res.status(200).send({ success: true, otp }); // Send success response with OTP
  } catch (error) {
      res.status(500).send({ success: false, error: 'Failed to send OTP' }); // Send error response
  }
});




// Endpoint for OTP verification
app.post('/verifyOTP', (req, res) => {
    const { email, enteredOTP } = req.body;
    if (!email || !enteredOTP) {
        return res.status(400).send({ success: false, error: 'Email and OTP are required' });
    }
    const savedOTP = users[email]; // Retrieve saved OTP for the email
    // const savedOTP = otp; // Retrieve saved OTP for the email
    
    console.log(savedOTP, enteredOTP)
    if (!savedOTP) {
        return res.status(404).send({ success: false, error: 'OTP not found for this email' });
    }

    if (Number(savedOTP) !== Number(enteredOTP)) {
        return res.status(401).send({ success: false, error: 'Invalid OTP' });
    }

    // Clear the used OTP
    delete users[email];

    res.status(200).send({ success: true, message: 'OTP verified successfully' });
});




async function connectToMongoDB(cName) {
  console.log(cName, "87:")
  const client = new MongoClient(mongoURI, { });

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    const db = client.db(dbName);
    const collection = db.collection(cName);
    return collection;
  } catch (error) {
    console.error('Error connecting to MongoDB Atlas:', error);
    throw new Error('Error connecting to the database');
  }
}

wss.on('connection', async (ws) => {
  try {
    
    const collection = await connectToMongoDB(chatCollectionName);
    if (!collection) {
      ws.send(JSON.stringify({ message: 'Error connecting to database' }));
      return;
    }

    ws.on('message', async (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        messageInfo = JSON.parse(message);
        let dataArray = await collection.find({}).toArray();
        let filterInfo = JSON.parse(JSON.stringify(dataArray));
        filterInfo = filterInfo.find(item => {
          return (item.user1 === parsedMessage.senderemail && item.user2 === parsedMessage.receiveremail)
                          ||  (item.user2 === parsedMessage.senderemail && item.user1 === parsedMessage.receiveremail)
                        })
        let filterIndex = 0;
        let filterInfoArray = JSON.parse(JSON.stringify(dataArray));
        filterIndex = filterInfoArray.findIndex(item => {
                        return (item.user1 === parsedMessage.senderemail && item.user2 === parsedMessage.receiveremail)
                                        ||  (item.user2 === parsedMessage.senderemail && item.user1 === parsedMessage.receiveremail)
                                      })
          console.log(dataArray, parsedMessage, filterInfo, filterIndex, 'filter')
          if(!filterInfo) {
            let insertItem = {
              user1: parsedMessage.senderemail,
              user2: parsedMessage.receiveremail,
              messages: [parsedMessage]
            }
            await collection.insertOne(insertItem)
           
          }
          else {
            filterInfo.messages.push(parsedMessage);
            // Your update operation
            const updateDoc = {
              $set: {
                messages: filterInfo.messages
              }
            };
            await collection.findOneAndUpdate({_id: dataArray[filterIndex]._id}, updateDoc);
          }
        let i=0;
        Array.from(wss.clients).forEach((client, index) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
           // if(senderemail & receiveremail) {
              // data = collection.find({receiveremail: receiveremail, senderemail: senderemail}).toArray();
           // }
          //  parsedMessage['index'] = i;
          let pMessage = JSON.parse(JSON.stringify(parsedMessage))
          pMessage['index'] = index;
          i++;
            // ws.send(JSON.stringify(data));
            console.log(receiveremail, senderemail, parsedMessage, '167::')
            if((receiveremail === parsedMessage.receiveremail && senderemail === parsedMessage.senderemail) || (receiveremail === parsedMessage.senderemail && senderemail === parsedMessage.receiveremail)) {
              client.send(JSON.stringify(parsedMessage));
            }
          }
        });
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    let data = [];
    if(senderemail && receiveremail) {
      data = await collection.find({}).toArray();
    }
    ws.send(JSON.stringify(data));
  } catch (error) {
    ws.send(JSON.stringify({ message: 'Error fetching data from database' }));
    console.error('Error:', error);
  }
});
app.get('/', async(req, res) => {
  console.log('test');
  try {
  const collection = await connectToMongoDB(chatCollectionName)
  // const data = await collection.find({}).toArray();
  let data = []
  res.send(JSON.stringify(data));
  } catch(error) {
    console.log(error)
  }


});


app.post('/activeChat', async (req, res) => {
    senderemail = await req.body.senderemail;
    receiveremail = await req.body.receiveremail;
    const collection = await connectToMongoDB('messages')
    let data = [];
    //if(senderemail & receiveremail) {
      console.log(!!senderemail || !!receiveremail, 'activechat')
      if(!senderemail || !receiveremail) {
         res.status(400).send({success: false, message: 'select a friend to chat'});
         return;
        }
      // if(!!senderemail || !!receiveremail) {
        data = await collection.find({}).toArray();
        data = data.filter(item => { 
          return (item.user1 === req.body.senderemail && 
                  item.user2 === req.body.receiveremail) ||
                  (item.user2 === req.body.senderemail &&
                  item.user1 === req.body.receiveremail)
        })
     // }
   // }
   console.log(data, req.body, "activechatData")
    res.status(200).send(JSON.stringify(data))
})

app.post('/register', async (req, res) => {
  const {userName, email} = req.body;
  try {
    
    
    const collection = await connectToMongoDB('register-user');

  //  ws.on('message', async (message) => {
    //  try {
        const parsedMessage = {userName, email};
        const data = await collection.find({email}).toArray();
          console.log(data.length, '160::')
          if(!data.length) {
            collection.insertOne(parsedMessage);
           return res.status(200).send({ success: true, message: 'user created successfully' });
          }
          else  {
           return res.status(400).send({ success: false, message: 'user already exists' });
          }
        
      //} catch (error) {
     // }
  //  });

    // const data = collection.find({}).toArray();

  } catch (error) {
    res.status(200).send({ success: false, message: 'Could not add the user. Please contact help desk.' });
    console.error('Error:', error);
  }
});


app.get('/getFriends', async(req, res) => {
  try {
  const collection = await connectToMongoDB('register-user')
  const data = await collection.find({}).toArray();
  res.send(JSON.stringify(data));
  } catch(error) {
    console.log(error)
  }


});
server.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}/`);
});
