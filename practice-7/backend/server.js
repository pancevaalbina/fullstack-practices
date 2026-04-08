const express = require('express');
const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');

const app = express();
const PORT = 3001;

app.use(express.json());

// Хранилища данных
let users = [];
let products = [];

// Хеширование паролей
async function hashPassword(password) {
    const rounds = 10;
    return bcrypt.hash(password, rounds);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// ============ АУТЕНТИФИКАЦИЯ ============

// Регистрация
app.post('/api/auth/register', async (req, res) => {
    const { email, first_name, last_name, password } = req.body;

    if (!email || !first_name || !last_name || !password) {
        return res.status(400).json({ 
            error: "email, first_name, last_name and password are required" 
        });
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
        passwordHash: hashedPassword,
        created_at: new Date()
    };

    users.push(newUser);

    const { passwordHash, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
});

// Вход
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

    res.json({ 
        login: true, 
        message: "Login successful",
        user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
        }
    });
});

// ============ CRUD ТОВАРОВ ============

// Создать товар
app.post('/api/products', (req, res) => {
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
        created_at: new Date()
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
});

// Получить список товаров
app.get('/api/products', (req, res) => {
    res.json(products);
});

// Получить товар по ID
app.get('/api/products/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
        return res.status(404).json({ error: "Product not found" });
    }
    
    res.json(product);
});

// Обновить товар
app.put('/api/products/:id', (req, res) => {
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

// Удалить товар
app.delete('/api/products/:id', (req, res) => {
    const productIndex = products.findIndex(p => p.id === req.params.id);
    
    if (productIndex === -1) {
        return res.status(404).json({ error: "Product not found" });
    }

    products.splice(productIndex, 1);
    res.json({ message: "Product deleted successfully" });
});

app.listen(PORT, () => {
    console.log(`✅ ПРАКТИКА 7 запущена на http://localhost:${PORT}`);
    console.log('\n📋 Доступные маршруты:');
    console.log('  POST   /api/auth/register  - регистрация');
    console.log('  POST   /api/auth/login     - вход');
    console.log('  POST   /api/products       - создать товар');
    console.log('  GET    /api/products       - список товаров');
    console.log('  GET    /api/products/:id   - товар по ID');
    console.log('  PUT    /api/products/:id   - обновить товар');
    console.log('  DELETE /api/products/:id   - удалить товар');
});