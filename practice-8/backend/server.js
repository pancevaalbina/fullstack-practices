const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');

const app = express();
const PORT = 3002;

app.use(express.json());

// Конфигурация JWT
const JWT_SECRET = "access_secret_practice8";
const ACCESS_EXPIRES_IN = "15m";

let users = [];
let products = [];

// Хеширование паролей
async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// Генерация JWT токена
function generateAccessToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
        },
        JWT_SECRET,
        { expiresIn: ACCESS_EXPIRES_IN }
    );
}

// Middleware для проверки токена
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

// ============ Аутентификация ============

app.post('/api/auth/register', async (req, res) => {
    const { email, first_name, last_name, password } = req.body;

    if (!email || !first_name || !last_name || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await hashPassword(password);
    
    const newUser = {
        id: nanoid(),
        email,
        first_name,
        last_name,
        passwordHash: hashedPassword
    };

    users.push(newUser);
    
    const { passwordHash, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "email and password are required" });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // Генерируем и возвращаем JWT токен
    const accessToken = generateAccessToken(user);
    
    res.json({ 
        accessToken,
        user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
        }
    });
});

// Защищенный маршрут - получение текущего пользователя
app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = users.find(u => u.id === req.user.sub);
    
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    res.json({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
    });
});

// ============ CRUD товаров (все маршруты защищены) ============

app.post('/api/products', authMiddleware, (req, res) => {
    const { title, category, description, price } = req.body;

    if (!title || !category || !description || price === undefined) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const newProduct = {
        id: nanoid(),
        title,
        category,
        description,
        price: Number(price),
        created_by: req.user.sub
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
});

app.get('/api/products', authMiddleware, (req, res) => {
    res.json(products);
});

app.get('/api/products/:id', authMiddleware, (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
        return res.status(404).json({ error: "Product not found" });
    }
    
    res.json(product);
});

app.put('/api/products/:id', authMiddleware, (req, res) => {
    const productIndex = products.findIndex(p => p.id === req.params.id);
    
    if (productIndex === -1) {
        return res.status(404).json({ error: "Product not found" });
    }

    const { title, category, description, price } = req.body;
    
    if (title) products[productIndex].title = title;
    if (category) products[productIndex].category = category;
    if (description) products[productIndex].description = description;
    if (price !== undefined) products[productIndex].price = Number(price);

    res.json(products[productIndex]);
});

app.delete('/api/products/:id', authMiddleware, (req, res) => {
    const productIndex = products.findIndex(p => p.id === req.params.id);
    
    if (productIndex === -1) {
        return res.status(404).json({ error: "Product not found" });
    }

    products.splice(productIndex, 1);
    res.json({ message: "Product deleted successfully" });
});

app.listen(PORT, () => {
    console.log(`Практика 8 запущена на http://localhost:${PORT}`);
    console.log('\n✨ Новое в практике 8: JWT токены и защищенные маршруты');
    console.log('  GET /api/auth/me - получение текущего пользователя (требует токен)');
});