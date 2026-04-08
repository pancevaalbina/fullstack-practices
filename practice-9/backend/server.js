const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');

const app = express();
const PORT = 3003;

app.use(express.json());

// Конфигурация JWT
const ACCESS_SECRET = "access_secret_practice9";
const REFRESH_SECRET = "refresh_secret_practice9";
const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";

let users = [];
let products = [];
let refreshTokens = new Set(); // Хранилище refresh токенов

// Хеширование паролей
async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// Генерация токенов
function generateAccessToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
        },
        ACCESS_SECRET,
        { expiresIn: ACCESS_EXPIRES_IN }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email
        },
        REFRESH_SECRET,
        { expiresIn: REFRESH_EXPIRES_IN }
    );
}

// Middleware для проверки access токена
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    try {
        const payload = jwt.verify(token, ACCESS_SECRET);
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

    // Генерируем пару токенов
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    refreshTokens.add(refreshToken); // Сохраняем refresh токен
    
    res.json({ 
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
        }
    });
});

// Обновление токенов (новый маршрут!)
app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: "refreshToken is required" });
    }

    if (!refreshTokens.has(refreshToken)) {
        return res.status(401).json({ error: "Invalid refresh token" });
    }

    try {
        const payload = jwt.verify(refreshToken, REFRESH_SECRET);
        const user = users.find(u => u.id === payload.sub);

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        // Ротация токенов: удаляем старый, создаем новый
        refreshTokens.delete(refreshToken);
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);
        refreshTokens.add(newRefreshToken);

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
});

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

// ============ CRUD товаров ============

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
    console.log(`Практика 9 запущена на http://localhost:${PORT}`);
    console.log('\n✨ Новое в практике 9: Refresh токены');
    console.log('  POST /api/auth/refresh - обновление пары токенов');
});