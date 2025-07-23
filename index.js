const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o1uqrsp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const postsCollection = client.db('forundb').collection('posts');
    const usersCollection = client.db('forundb').collection('users');

    // ✅ Create a New Post
    app.post('/posts', async (req, res) => {
      const newPost = req.body;
      const result = await postsCollection.insertOne(newPost);
      res.send(result);
    });

    // ✅ Search by Tag
    app.get('/posts/search', async (req, res) => {
      const tag = req.query.tag;
      if (!tag) return res.status(400).json({ error: 'Tag is required' });

      const searchRegex = new RegExp(tag, 'i');
      const result = await postsCollection.find({ tags: { $in: [searchRegex] } }).toArray();
      res.send(result);
    });

    // ✅ All Unique Tags
    app.get('/tags', async (req, res) => {
      try {
        const tags = await postsCollection.distinct('tags');
        res.send(tags);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Failed to fetch tags' });
      }
    });

    // ✅ Featured Posts
    app.get('/posts/featured', async (req, res) => {
      try {
        const featuredPosts = await postsCollection
          .find({ featured: true })
          .limit(4)
          .toArray();
        res.send(featuredPosts);
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch featured posts' });
      }
    });

    // ✅ Recent Posts
    app.get('/posts/recent', async (req, res) => {
      try {
        const recentPosts = await postsCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(4)
          .toArray();
        res.send(recentPosts);
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch recent posts' });
      }
    });

    // ✅ Trending Posts (based on likes)
    app.get('/posts/trending', async (req, res) => {
      try {
        const trendingPosts = await postsCollection
          .find()
          .sort({ totalLiked: -1 })
          .limit(4)
          .toArray();
        res.send(trendingPosts);
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch trending posts' });
      }
    });

    // ✅ Posts by Tag (for tag filtering)
    app.get('/posts/byTag/:tagName', async (req, res) => {
      const tagName = req.params.tagName;
      const searchRegex = new RegExp(tagName, 'i');
      const result = await postsCollection.find({ tags: { $in: [searchRegex] } }).toArray();
      res.send(result);
    });

    app.get('/posts/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await postsCollection.findOne(query);
  res.send(result);
});

// ✅ Update totalLiked (Vote System)
app.patch('/posts/:id/vote', async (req, res) => {
  const { voteType } = req.body; // 'upvote' or 'downvote'
  const { id } = req.params;

  try {
    const query = { _id: new ObjectId(id) };
    const post = await postsCollection.findOne(query);
    if (!post) return res.status(404).send({ message: 'Post not found' });

    let updatedCount = post.totalLiked || 0;
    if (voteType === 'upvote') updatedCount++;
    else if (voteType === 'downvote') updatedCount--;

    const updateDoc = {
      $set: { totalLiked: updatedCount }
    };
    const result = await postsCollection.updateOne(query, updateDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to vote', error });
  }
});

// ✅ Save user on membership
app.post('/users', async (req, res) => {
  const user = req.body;
  const query = { email: user.email };
  const existingUser = await usersCollection.findOne(query);

  if (existingUser) {
    return res.send({ message: 'User already a member' });
  }

  const result = await usersCollection.insertOne(user);
  res.send(result);
});

// ✅ Check if user is member
app.get('/users/member/:email', async (req, res) => {
  const email = req.params.email;
  const user = await usersCollection.findOne({ email });
  res.send({ isMember: !!user });
});

  // ✅ Save Comment
    app.post('/posts/:id/comments', async (req, res) => {
      const { id } = req.params;
      const comment = req.body.comment;
      const result = await postsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $push: { comments: comment } }
      );
      res.send(result);
    });

    // ✅ Get Comments
    app.get('/posts/:id/comments', async (req, res) => {
      const { id } = req.params;
      const post = await postsCollection.findOne(
        { _id: new ObjectId(id) },
        { projection: { comments: 1 } }
      );
      res.send(post?.comments || []);
    });

    app.get('/users/leaderboard', async (req, res) => {
  const users = await usersCollection.aggregate([
    {
      $lookup: {
        from: 'posts',
        localField: 'email',
        foreignField: 'authorEmail',
        as: 'posts',
      },
    },
    {
      $addFields: {
        totalPosts: { $size: '$posts' },
      },
    },
    {
      $sort: { totalPosts: -1 },
    },
    {
      $project: {
        name: 1,
        email: 1,
        totalPosts: 1,
      },
    },
  ]).toArray();

  res.send(users);
});











    console.log("Pinged your deployment. You successfully connected to MongoDB!");

  } finally {
    // Optional close if needed
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
