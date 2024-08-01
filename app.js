const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });


const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    port: 3316,
    database: 'healthfoodchecker'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});


app.set('view engine', 'ejs');


app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));


app.get('/', (req, res) => {
    res.render('index');
});

app.get('/CreateAcc', (req, res) => {
    res.render('CreateAcc');
});

app.get('/contactUs', (req, res) => {
    res.render('contactUs');
});

app.get('/bmi', (req, res) => {
    const userId = req.query.userId;
    const sql = 'SELECT bmi FROM users WHERE userId = ?';
    connection.query(sql, [userId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving BMI');
        }
        const bmi = results.length > 0 ? results[0].bmi : null; 
        res.render('bmi', { userId: userId, bmi: bmi });
    });
});

app.post('/summary', (req, res) => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFats = 0;
    let totalCarbs = 0;

    const foodItems = req.body;


    connection.query('SELECT * FROM food', (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving food items');
        }

        results.forEach(item => {
            const servingSize = parseInt(foodItems[`serving_${item.foodId}`]) || 0;
            if (servingSize > 0) {
                const factor = servingSize;

                totalCalories += item.calories * factor;
                totalProtein += item.protein * factor;
                totalFats += item.fats * factor;
                totalCarbs += item.carbs * factor;
            }
        });

    
        const userId = req.body.userId; 
        const bmiQuery = 'SELECT bmi FROM users WHERE userId = ?';
        connection.query(bmiQuery, [userId], (bmiError, bmiResults) => {
            if (bmiError) {
                console.error('Error fetching BMI:', bmiError);
                return res.status(500).send('Error fetching BMI');
            }

            const bmi = bmiResults.length > 0 ? bmiResults[0].bmi : null;

            res.render('summary', {
                totalCalories: totalCalories.toFixed(2),
                totalProtein: totalProtein.toFixed(2),
                totalFats: totalFats.toFixed(2),
                totalCarbs: totalCarbs.toFixed(2),
                bmi: bmi
            });
        });
    });
});


app.get('/login', (req, res) => {
    res.render('login');
});
app.get('/features', (req, res) => {
    res.render('features');
});

app.get('/addFood', (req, res) => {
    res.render('addFood');
});

app.post('/CreateAcc', (req, res) => {
    const { username, password, email } = req.body;
    const sql = 'INSERT INTO users (username, password, email) VALUES (?, ?, ?)';
    connection.query(sql, [username, password, email], (error, results) => {
        if (error) {
            console.error('Error adding user:', error);
            res.status(500).send('Error adding user');
        } else {
            res.redirect('/login');
        }
    });
});


app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ?';
    connection.query(sql, [username], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving user');
        }
        if (results.length > 0 && results[0].password === password) {
            res.redirect(`/bmi?userId=${results[0].userId}`);
        } else {
            res.status(401).send('Incorrect username or password');
        }
    });
});

app.post('/bmi', (req, res) => {
    const { userId, bmi } = req.body;
    const sql = 'UPDATE users SET bmi = ? WHERE userId = ?';
    connection.query(sql, [bmi, userId], (error, results) => {
        if (error) {
            console.error('Error updating BMI:', error);
            res.status(500).send('Error updating BMI');
        } else {
            res.redirect(`/analysis?userId=${userId}`);
        }
    });
});

app.get('/analysis', (req, res) => {
    const sql = 'SELECT * FROM food';
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('Error retrieving food items:', error.message);
            return res.status(500).send('Error retrieving food items');
        }
        res.render('analysis', { foodItems: results });
    });
});

app.post('/addfood', upload.single('image'), (req, res) => {
    const { name, serving, calories, protein, fats, carbs } = req.body;
    const image = req.file ? req.file.filename : null;
    const sql = 'INSERT INTO food (name, serving, calories, protein, fats, carbs, image, custom) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    connection.query(sql, [name, 100, calories, protein, fats, carbs, image, 1], (error, results) => {
        if (error) {
            console.error('Error adding food:', error);
            return res.status(500).send('Error adding food');
        }
        res.redirect('/analysis');
    });
});


app.get('/editFood/:id', (req, res) => {
    const foodId = req.params.id;
    const sql = 'SELECT * FROM food WHERE foodId = ?';
    connection.query(sql, [foodId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving food item');
        }
        if (results.length > 0) {
            res.render('editFood', { food: results[0] });
        } else {
            res.status(404).send('Food item not found');
        }
    });
});

app.post('/editFood/:id', upload.single('image'), (req, res) => {
    const foodId = req.params.id;
    const { name, serving, calories, protein, fats, carbs } = req.body;
    let image = req.body.currentImage;
    if (req.file) {
        image = req.file.filename;
    }
    const sql = 'UPDATE food SET name = ?, serving = ?, calories = ?, protein = ?, fats = ?, carbs = ?, image = ? WHERE foodId = ?';
    connection.query(sql, [name, serving, calories, protein, fats, carbs, image, foodId], (error, results) => {
        if (error) {
            console.error('Error updating food item:', error);
            return res.status(500).send('Error updating food item');
        }
        res.redirect('/analysis');
    });
});

app.get('/deleteFood/:id', (req, res) => {
    const foodId = req.params.id;
    const sql = 'DELETE FROM food WHERE foodId = ? AND custom = 1';
    connection.query(sql, [foodId], (error, results) => {
        if (error) {
            console.error('Error deleting food item:', error);
            res.status(500).send('Error deleting food item');
        } else {
            res.redirect('/analysis');
        }
    });
});


// app.get('/users/:id', (req, res) => {
//     const userId = req.params.id;
//     const sql = 'SELECT * FROM users WHERE userId = ?';
//     connection.query(sql, [userId], (error, results) => {
//         if (error) {
//             console.error('Database query error:', error.message);
//             return res.status(500).send('Error retrieving user by ID');
//         }
//         if (results.length > 0) {
//             res.render('user', { user: results[0] });
//         } else {
//             res.status(404).send('User not found');
//         }
//     });
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
