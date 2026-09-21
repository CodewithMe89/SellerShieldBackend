const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const returnRoutes = require('./routes/returnRoutes');
const profitRoutes = require('./routes/profitRoute');
const inventoryRoutes = require('./routes/inventoryRoutes');
const insightsRoutes = require("./routes/insightsRoutes");

const app = express();

app.use(cors({
    origin: "*",
    credentials:true,
}));
app.use(express.json());

//database
connectDB();

//routes
app.use("/api/auth",authRoutes)
app.use("/api/users",userRoutes)
app.use("/api/products", productRoutes);
app.use("/api/orders",orderRoutes)
app.use("/api/expenses",expenseRoutes)
app.use("/api/returns",returnRoutes)
app.use("/api/profit",profitRoutes)
app.use("/api/inventory",inventoryRoutes)
app.use("/api/insights",insightsRoutes);

//healthCheck
app.get('/', (req,res) => {
    res.json({
        message:"SellerShield API is running"
    });
});

const port = process.env.port || 5000;

app.listen(port,() => {
    console.log(`server is running on ${port}`)
});

module.exports = app;
