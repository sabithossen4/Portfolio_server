const express = require('express')
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express()
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o1uqrsp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const postsCollection = client.db('forundb').collection('posts');


    app.get('/posts/search', async (req, res) => {
  const tag = req.query.tag;
  if (!tag) return res.status(400).json({ error: 'Tag is required' });

  const searchRegex = new RegExp(tag, 'i'); // case-insensitive
  const result = await postsCollection.find({ tags: { $in: [searchRegex] } }).toArray();
  res.send(result);
});

// tags section 
app.get('/tags', async (req, res) => {
  try {
    const tags = await client.db('forundb').collection('posts').distinct('tags');
    res.send(tags);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Failed to fetch tags' });
  }
});






    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})