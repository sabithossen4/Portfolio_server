const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
    const announcementsCollection = client.db("forundb").collection("announcements");
    const commentsCollection = client.db("forundb").collection("comments");
    const adminsCollection = client.db("forundb").collection("admins");
    const tagsCollection = client.db('forundb').collection('tags');




    // Create a New Post
    app.post('/posts', async (req, res) => {
  const post = req.body;
  const result = await postsCollection.insertOne({ ...post, createdAt: new Date() });
  res.send(result);
});  

        // Posts with Pagination & Sorting
app.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const sort = req.query.sort || 'newest';
    const limit = 6;
    const skip = (page - 1) * limit;
    const totalCount = await postsCollection.countDocuments();
    let posts;
    if (sort === 'popularity') {
      posts = await postsCollection.aggregate([
        {
          $addFields: {
            voteDifference: { $subtract: ["$upVote", "$downVote"] }
          }
        },
        { $sort: { voteDifference: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]).toArray();
    } else {
      posts = await postsCollection.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    }
    res.send({ posts, totalCount });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to fetch posts" });
  }
});

 // Get a single post by ID
app.get('/posts/:id', async (req, res) => {
  const id = req.params.id;
  const result = await postsCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

    // Search by Tag
    app.get('/posts/search', async (req, res) => {
      const tag = req.query.tag;
      if (!tag) return res.status(400).json({ error: 'Tag is required' });
      const searchRegex = new RegExp(tag, 'i');
      const result = await postsCollection.find({ tags: { $in: [searchRegex] } }).toArray();
      res.send(result);
    });    

    // Featured Posts
    app.get('/posts/featured', async (req, res) => {
      const featuredPosts = await postsCollection.find({ featured: true }).limit(4).toArray();
      res.send(featuredPosts);
    });

    // Recent Posts
    app.get('/posts/recent', async (req, res) => {
      const recentPosts = await postsCollection.find().sort({ createdAt: -1 }).limit(4).toArray();
      res.send(recentPosts);
    });

    // Trending Posts
    app.get('/posts/trending', async (req, res) => {
      const trendingPosts = await postsCollection.find().sort({ totalLiked: -1 }).limit(4).toArray();
      res.send(trendingPosts);
    });

    // Posts by Tag
    app.get('/posts/byTag/:tagName', async (req, res) => {
      const tagName = req.params.tagName;
      const searchRegex = new RegExp(tagName, 'i');
      const result = await postsCollection.find({ tags: { $in: [searchRegex] } }).toArray();
      res.send(result);
    });   

// Vote System
app.patch('/posts/:id/vote', async (req, res) => {
  const { likeChange, dislikeChange } = req.body;
  const { id } = req.params;
  const query = { _id: new ObjectId(id) };  
  const post = await postsCollection.findOne(query);
  if (!post) return res.status(404).send({ message: 'Post not found' });  
  const updatedLikes = (post.upVote || 0) + (likeChange || 0);
  const updatedDislikes = (post.downVote || 0) + (dislikeChange || 0);  
  const result = await postsCollection.updateOne(
    query, 
    { 
      $set: { 
        upVote: updatedLikes,
        downVote: updatedDislikes 
      } 
    }
  );  
  res.send(result);
});

       // Save Comment
    app.post('/posts/:id/comments', async (req, res) => {
      const { id } = req.params;
      const comment = req.body.comment;
      const result = await postsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $push: { comments: comment } }
      );
      res.send(result);
    });

    // Get Comments
    app.get('/posts/:id/comments', async (req, res) => {
      const { id } = req.params;
      const post = await postsCollection.findOne(
        { _id: new ObjectId(id) },
        { projection: { comments: 1 } }
      );
      res.send(post?.comments || []);
    });



// 📌 Get posts sorted by most liked (Popular Posts)
app.get('/posts/popular', async (req, res) => {
  const result = await postsCollection.find().sort({ totalLiked: -1 }).toArray();
  res.send(result);
});    

app.get('/posts/leaderboard', async (req, res) => {
  const topPosts = await postsCollection
    .find()
    .sort({ totalLiked: -1 }) // vote অনুসারে descending
    .limit(10)
    .toArray();
  res.send(topPosts);
});
    
    // Save new user (POST)
app.post('/users', async (req, res) => {
  const user = req.body;
  const existingUser = await usersCollection.findOne({ email: user.email });
  if (existingUser) {
    return res.send({ message: 'user already exists' });
  }
  const result = await usersCollection.insertOne({ ...user, isMember: false });
  res.send(result);
});

    app.get('/users', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const users = await usersCollection.find()
    .skip(skip)
    .limit(limit)
    .toArray();
  const totalUsers = await usersCollection.countDocuments();
  res.send({ users, totalUsers });
}); 

app.delete('/users/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await usersCollection.deleteOne(query);
  res.send(result);
});
    
    // Check membership status by email
app.get('/users/member/:email', async (req, res) => {
  const email = req.params.email;
  const user = await usersCollection.findOne({ email });
  res.send({ isMember: user?.isMember || false });
});

// Leaderboard route
app.get('/users/leaderboard', async (req, res) => {
  const users = await usersCollection
    .find({ membership: 'premium' })
    .sort({ totalLiked: -1 }) // বেশি লাইক পেলে উপরে
    .project({ name: 1, email: 1, totalLiked: 1, _id: 0 }) // প্রয়োজনীয় field গুলা
    .toArray();
  res.send(users);
});

    // ✅ Admin check route
app.get('/users/admin/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const query = { email: email };
    const user = await usersCollection.findOne(query);
    const isAdmin = user?.role === 'admin';
    res.send({ admin: isAdmin });
  } catch (error) {
    res.status(500).send({ error: 'Internal Server Error' });
  }
});


    app.patch('/users/admin/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      role: 'admin',
    },
  };
  const result = await usersCollection.updateOne(filter, updateDoc);
  res.send(result);
});

// Membership API - Updated
app.patch('/users/membership/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const result = await usersCollection.updateOne(
      { email },
      { $set: { isMember: true, membership: 'premium' } }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'Membership update failed' });
  }
});

// Membership API
app.patch('/users/:id/membership', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isMember: true } }
    );
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: 'Membership update failed' });
  }
});

// PATCH to make a user member
app.patch("/users/:email", async (req, res) => {
  const { email } = req.params;
  const updatedDoc = {
    $set: {
      isMember: req.body.isMember,
    },
  };
  const result = await usersCollection.updateOne({ email }, updatedDoc);
  res.send(result);
});

app.get('/users/top-voted', async (req, res) => {
  const users = await usersCollection
    .find()
    .sort({ totalVote: -1 })
    .limit(10)
    .toArray();
  res.send(users);
});

// ✅ ✅ Add this route for MyProfile.jsx API
app.get('/user-profile/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const user = await usersCollection.findOne({ email });
    const recentPosts = await postsCollection
      .find({ authorEmail: email })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();
    res.send({ user, recentPosts });
  } catch (error) {
    console.error('Error in /user-profile/:email:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});

// ✅ ✅ Add this route for AddPost.jsx logic (checking post count)
app.get('/user-post-count/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const count = await postsCollection.countDocuments({ authorEmail: email });
    res.send({ count });
  } catch (error) {
    console.error('Error in /user-post-count:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});

// 🔹 Get All Announcements (Descending)
app.get('/announcements', async (req, res) => {
  const result = await announcementsCollection.find().sort({ createdAt: -1 }).toArray();
  res.send(result);
});

// 🔹 Create New Announcement
app.post('/announcements', async (req, res) => {
  const newAnnouncement = { ...req.body, createdAt: new Date() };
  const result = await announcementsCollection.insertOne(newAnnouncement);
  res.send(result);
});

// 🔹 Delete Announcement (Admin use)
app.delete('/announcements/:id', async (req, res) => {
  const id = req.params.id;
  const result = await announcementsCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

// Get all comments for a post
app.get('/comments/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const comments = await commentsCollection.find({ postId }).sort({ createdAt: -1 }).toArray();
    res.send(comments);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch comments' });
  }
});

// Post a new comment
app.post('/comments', async (req, res) => {
  try {
    const comment = req.body;
    comment.createdAt = new Date();
    const result = await commentsCollection.insertOne(comment);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to post comment' });
  }
});

// কমেন্ট রিপোর্ট করার রাউট
app.post('/comments/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    const { reporterEmail, feedback } = req.body;
    const report = {
      commentId: id,
      reporterEmail,
      feedback,
      reportedAt: new Date()
    };
    // রিপোর্ট কালেকশন তৈরি করুন (যদি না থাকে)
    const reportsCollection = client.db('forundb').collection('reports');
    const result = await reportsCollection.insertOne(report);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'রিপোর্ট জমা দিতে ব্যর্থ' });
  }
});

    // Get All Members
    app.get('/members', async (req, res) => {
      const result = await usersCollection.find({ isMember: true }).toArray();
      res.send(result);
    });

   // Leaderboard route
app.get("/leaderboard", async (req, res) => {
  try {
    const topUsers = await usersCollection
      .find()
      .sort({ voteCount: -1 })
      .limit(10)
      .toArray();
    res.send(topUsers);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch leaderboard" });
  }
});

// GET all posts by a specific user
app.get('/my-posts/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const posts = await postsCollection
      .find({ authorEmail: email })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(posts);
  } catch (err) {
    console.error('Error in /my-posts:', err);
    res.status(500).send({ message: 'Failed to fetch posts' });
  }
});

// DELETE post by ID (only user's own posts)
app.delete('/my-posts/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await postsCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).send({ message: 'Failed to delete post' });
  }
});

// Get all unique tags
app.get('/tags', async (req, res) => {
  try {
    const posts = await postsCollection.find().toArray();
    const allTags = posts.flatMap(post => post.tags || []);
    const uniqueTags = [...new Set(allTags)];
    res.send(uniqueTags);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch tags' });
  }
});

// অ্যাডমিনের জন্য রিপোর্ট দেখার রাউট (পয়েন্ট ১৪ এর জন্য)
app.get('/admin/reports', async (req, res) => {
  try {
    const reportsCollection = client.db('forundb').collection('reports');
    const reports = await reportsCollection
      .aggregate([
        {
          $lookup: {
            from: "comments",
            localField: "commentId",
            foreignField: "_id",
            as: "comment"
          }
        },
        { $unwind: "$comment" },
        {
          $lookup: {
            from: "users",
            localField: "reporterEmail",
            foreignField: "email",
            as: "reporter"
          }
        },
        { $unwind: "$reporter" },
        { $sort: { reportedAt: -1 } }
      ])
      .toArray();

    res.send(reports);
  } catch (error) {
    res.status(500).send({ message: 'রিপোর্ট লোড করতে ব্যর্থ' });
  }
});


// User Registration
    app.post('/register', async (req, res) => {
      try {
        const { name, email, password, photoURL } = req.body;
        
        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user with bronze badge
        const newUser = {
          name,
          email,
          password: hashedPassword,
          photoURL: photoURL || '',
          isMember: false,
          badges: ['bronze'],
          role: 'user',
          createdAt: new Date()
        };

        const result = await usersCollection.insertOne(newUser);
        
        // Generate JWT token
        const token = jwt.sign(
          { email: newUser.email, id: result.insertedId },
          process.env.JWT_SECRET,
          { expiresIn: '1d' }
        );

        // Remove password before sending response
        const userResponse = { ...newUser };
        delete userResponse.password;

        res.status(201).json({ 
          success: true, 
          message: 'Registration successful',
          user: userResponse,
          token 
        });

      } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Registration failed',
          error: error.message 
        });
      }
    });

    // User Login..........
    app.post('/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        
        // Find user
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).json({ 
            success: false, 
            message: 'User not found' 
          });
        }

        // Check password
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid credentials' 
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          { email: user.email, id: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '1d' }
        );

        // Remove password before sending response
        const userResponse = { ...user };
        delete userResponse.password;

        res.status(200).json({ 
          success: true, 
          message: 'Login successful',
          user: userResponse,
          token 
        });

      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Login failed',
          error: error.message 
        });
      }
    });

    // Social Login (Google/Facebook)
    app.post('/social-login', async (req, res) => {
      try {
        const { name, email, photoURL } = req.body;
        
        // Check if user exists
        let user = await usersCollection.findOne({ email });

        if (!user) {
          // Create new user with bronze badge
          const newUser = {
            name,
            email,
            photoURL: photoURL || '',
            isMember: false,
            badges: ['bronze'],
            role: 'user',
            createdAt: new Date()
          };
          
          const result = await usersCollection.insertOne(newUser);
          user = { ...newUser, _id: result.insertedId };
        }

        // Generate JWT token
        const token = jwt.sign(
          { email: user.email, id: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '1d' }
        );

        // Remove password before sending response
        const userResponse = { ...user };
        delete userResponse.password;

        res.status(200).json({ 
          success: true, 
          message: 'Social login successful',
          user: userResponse,
          token 
        });

      } catch (error) {
        console.error('Social login error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Social login failed',
          error: error.message 
        });
      }
    });

    // Protected route example...........
    app.get('/profile', async (req, res) => {
      try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
          return res.status(401).json({ 
            success: false, 
            message: 'No token provided' 
          });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await usersCollection.findOne({ 
          email: decoded.email,
          _id: new ObjectId(decoded.id) 
        });

        if (!user) {
          return res.status(404).json({ 
            success: false, 
            message: 'User not found' 
          });
        }

        // Remove password before sending response
        const userResponse = { ...user };
        delete userResponse.password;

        res.status(200).json({ 
          success: true, 
          user: userResponse 
        });

      } catch (error) {
        console.error('Profile error:', error);
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({ 
            success: false, 
            message: 'Invalid token' 
          });
        }
        res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch profile',
          error: error.message 
        });
      }
    });


    // অ্যাডমিন ভেরিফিকেশন মিডলওয়্যার
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'টোকেন প্রদান করা হয়নি' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await usersCollection.findOne({
      _id: new ObjectId(decoded.id),
      role: 'admin'
    });
    if (!user) {
      return res.status(403).json({ success: false, message: 'অ্যাডমিন এক্সেস প্রয়োজন' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('অ্যাডমিন ভেরিফিকেশন এরর:', error);
    return res.status(401).json({ success: false, message: 'অবৈধ টোকেন' });
  }
};

// অ্যাডমিন প্রোফাইল
app.get('/admin/profile', verifyAdmin, async (req, res) => {
  try {
    const adminId = req.user._id;
    
    // অ্যাডমিন ডিটেইল্স
    const admin = await usersCollection.findOne({ _id: new ObjectId(adminId) });
    
    // সাইট স্ট্যাটিস্টিক্স
    const totalPosts = await postsCollection.countDocuments();
    const totalComments = await commentsCollection.countDocuments();
    const totalUsers = await usersCollection.countDocuments();
    
    // ট্যাগ লিস্ট
    const tags = await postsCollection.distinct('tags');    
    res.status(200).json({
      success: true,
      admin: {
        name: admin.name,
        email: admin.email,
        photoURL: admin.photoURL,
        stats: {
          totalPosts,
          totalComments,
          totalUsers
        },
        tags
      }
    });
  } catch (error) {
    console.error('অ্যাডমিন প্রোফাইল এরর:', error);
    res.status(500).json({ success: false, message: 'অ্যাডমিন প্রোফাইল লোড করতে ব্যর্থ' });
  }
});

// ইউজার ম্যানেজমেন্ট
app.get('/admin/users', verifyAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;    
    const users = await usersCollection.find()
      .skip(skip)
      .limit(limit)
      .project({ password: 0 }) // পাসওয়ার্ড হিডেন
      .toArray();      
    const totalUsers = await usersCollection.countDocuments();    
    res.status(200).json({ success: true, users, totalUsers });
  } catch (error) {
    console.error('ইউজার লোড এরর:', error);
    res.status(500).json({ success: false, message: 'ইউজার লোড করতে ব্যর্থ' });
  }
});

// ইউজারকে অ্যাডমিন বানানো
app.patch('/admin/users/make-admin/:id', verifyAdmin, async (req, res) => {
  try {
    const userId = req.params.id;    
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { role: 'admin' } }
    );    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'ইউজার পাওয়া যায়নি' });
    }
        res.status(200).json({ success: true, message: 'ইউজারকে অ্যাডমিন বানানো হয়েছে' });
  } catch (error) {
    console.error('অ্যাডমিন বানানোর এরর:', error);
    res.status(500).json({ success: false, message: 'ইউজার রোল আপডেট করতে ব্যর্থ' });
  }
});


// রিপোর্টেড কমেন্টস এর জন্য আপডেটেড রাউট
// ইউজার ওয়ার্ন করার রাউট
app.post('/admin/warn-user/:email', verifyAdmin, async (req, res) => {
  try {
    const { email } = req.params;
    
    await usersCollection.updateOne(
      { email },
      { 
        $push: { 
          warnings: {
            message: 'Your comment was reported and removed by admin',
            date: new Date(),
            type: 'comment_report'
          } 
        } 
      }
    );

    res.status(200).json({ 
      success: true,
      message: 'User has been warned successfully'
    });
  } catch (error) {
    console.error('Error warning user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to warn user' 
    });
  }
});

// রিপোর্টেড কমেন্টস দেখার রাউট (আপডেটেড)
app.get('/admin/reported-comments', verifyAdmin, async (req, res) => {
  try {
    const reportsCollection = client.db('forundb').collection('reports');
    const reports = await reportsCollection.aggregate([
      {
        $lookup: {
          from: 'comments',
          localField: 'commentId',
          foreignField: '_id',
          as: 'comment'
        }
      },
      { $unwind: '$comment' },
      {
        $lookup: {
          from: 'users',
          localField: 'comment.authorEmail',
          foreignField: 'email',
          as: 'author'
        }
      },
      { $unwind: '$author' },
      {
        $lookup: {
          from: 'users',
          localField: 'reporterEmail',
          foreignField: 'email',
          as: 'reporter'
        }
      },
      { $unwind: '$reporter' },
      {
        $project: {
          'text': '$comment.text',
          'postId': '$comment.postId',
          'author': {
            'name': '$author.name',
            'email': '$author.email',
            'photoURL': '$author.photoURL'
          },
          'reporter': {
            'name': '$reporter.name',
            'email': '$reporter.email',
            'photoURL': '$reporter.photoURL'
          },
          'feedback': 1,
          'reportedAt': 1,
          '_id': '$comment._id'
        }
      },
      { $sort: { reportedAt: -1 } }
    ]).toArray();

    res.status(200).json({ 
      success: true,
      reports 
    });
  } catch (error) {
    console.error('Error fetching reported comments:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch reported comments' 
    });
  }
});

// কমেন্ট ডিলিট রাউট আপডেট
app.delete('/admin/comments/:id', verifyAdmin, async (req, res) => {
  try {
    const commentId = req.params.id;
    const reportsCollection = client.db('forundb').collection('reports');
    const commentsCollection = client.db('forundb').collection('comments');

    // কমেন্ট ডিলিট
    const deleteResult = await commentsCollection.deleteOne({ 
      _id: new ObjectId(commentId) 
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // সংশ্লিষ্ট রিপোর্ট ডিলিট
    await reportsCollection.deleteMany({ 
      commentId: new ObjectId(commentId) 
    });

    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
});

// অ্যানাউন্সমেন্ট তৈরি
app.post('/admin/announcements', verifyAdmin, async (req, res) => {
  try {
    const { title, description } = req.body;
    const admin = req.user;
        const newAnnouncement = {
      title,
      description,
      author: {
        name: admin.name,
        email: admin.email,
        photoURL: admin.photoURL
      },
      createdAt: new Date()
    };    
    const result = await announcementsCollection.insertOne(newAnnouncement);
        res.status(201).json({
      success: true,
      message: 'অ্যানাউন্সমেন্ট তৈরি করা হয়েছে',
      announcement: { ...newAnnouncement, _id: result.insertedId }
    });
  } catch (error) {
    console.error('অ্যানাউন্সমেন্ট তৈরি এরর:', error);
    res.status(500).json({ success: false, message: 'অ্যানাউন্সমেন্ট তৈরি করতে ব্যর্থ' });
  }
});

app.get('/admin/stats', verifyAdmin, async (req, res) => {
  try {
    // Get counts for posts, comments, and users
    const totalPosts = await postsCollection.countDocuments();
    const totalComments = await commentsCollection.countDocuments();
    const totalUsers = await usersCollection.countDocuments();
    
    // Get admin profile data
    const admin = await usersCollection.findOne(
      { _id: new ObjectId(req.user._id) },
      { projection: { name: 1, email: 1, photoURL: 1, role: 1 } }
    );
    
    // Get all tags
    const tags = await tagsCollection.find().toArray();
    
    res.status(200).json({
      success: true,
      data: {
        admin,
        stats: {
          totalPosts,
          totalComments,
          totalUsers,
          chartData: [
            { name: 'Posts', value: totalPosts },
            { name: 'Comments', value: totalComments },
            { name: 'Users', value: totalUsers }
          ]
        },
        tags
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch admin dashboard statistics' 
    });
  }
});

app.post('/admin/tags', verifyAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Tag name is required and must be a non-empty string'
      });
    }
    
    // Check if tag already exists
    const existingTag = await tagsCollection.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: 'Tag already exists'
      });
    }
    
    const newTag = {
      name: name.trim(),
      createdAt: new Date(),
      createdBy: req.user._id
    };
    
    const result = await tagsCollection.insertOne(newTag);
    
    res.status(201).json({
      success: true,
      message: 'Tag added successfully',
      tag: { ...newTag, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add new tag' 
    });
  }
});


app.get('/admin/tags', verifyAdmin, async (req, res) => {
  try {
    const tags = await tagsCollection.find().sort({ name: 1 }).toArray();
    res.status(200).json({
      success: true,
      tags
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch tags' 
    });
  }
});


app.delete('/admin/tags/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if tag exists
    const tag = await tagsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }
    
    // Check if tag is being used in any posts
    const postsWithTag = await postsCollection.countDocuments({ 
      tags: { $regex: new RegExp(`^${tag.name}$`, 'i') } 
    });
    
    if (postsWithTag > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete tag that is in use by posts'
      });
    }
    
    await tagsCollection.deleteOne({ _id: new ObjectId(id) });
    
    res.status(200).json({
      success: true,
      message: 'Tag deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete tag' 
    });
  }
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
