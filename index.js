require('dotenv').config({ path: './credentials.env'})
const express = require('express')
const app = express()
const bodyParser = require('body-parser')

app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing 
app.set('view engine', 'ejs')

// database
const neo4j = require('neo4j-driver')
const driver = neo4j.driver(process.env.DB_URI, neo4j.auth.basic(process.env.DB_USER, process.env.DB_PASSWORD))

app.get('/', async (req, res) => {
	let result = await get_users()
	res.render('index', {result: result})
})

app.get('/new-person', (req, res) => {
	res.render('new-person')
})

app.post('/new-person', async (req, res) => {
		let firstName = req.body.first_name
		let lastName = req.body.last_name
		let user = {first_name: firstName, last_name: lastName}

		await create_new_user(user)
		res.redirect('/')
})

app.get('/new-relationship', (req, res) => {
	res.render('new-relationship')
})

app.post('/new-relationship', async (req, res) => {
		let user1 = { first_name: req.body.person1_first_name,
			last_name: req.body.person1_last_name,
			id: req.body.person1_id }
		let user2 = { first_name: req.body.person2_first_name,
			last_name: req.body.person2_last_name,
			id: req.body.person2_id  }
		let rel_type = req.body.relation_type

		await create_new_relation(user1, user2, rel_type)
		res.redirect('/')
})

app.listen(3000)

async function get_users() {
	let req_result = ''
	let result = null
	try {
		const session = driver.session()
		result = await session.run(
		'match (a:Person) return a')
		await session.close()
	} catch(error) {
		console.error(error)
	}
	return result
}

async function create_new_user(user) {
	try {
		const session = driver.session()
		result = await session.run(
		'create (a:Person {first_name: $first_name, last_name: $last_name})',
		{ first_name: user.first_name, last_name: user.last_name})
		await session.close()
	} catch(error) {
		console.error(error)
	}
}

async function create_new_relation(user1, user2, rel_type) {
	if (!user1 || !user2 ||
		!user1.first_name ||
		!user1.last_name ||
		!user2.first_name ||
		!user2.last_name) {
		return console.log('Invalid user data');
	}

	let query = 'MATCH (u1:Person), (u2:Person) WHERE ';
	if (user1.id) {
		query += `u1.id = ${user1.id} AND `;
	} else {
		query += `u1.first_name = "${user1.first_name}" AND u1.last_name = "${user1.last_name}" AND `;
	}
	if (user2.id) {
		query += `u2.id = ${user2.id}`;
	} else {
		query += `u2.first_name = "${user2.first_name}" AND u2.last_name = "${user2.last_name}"`;
	}
	query += ` CREATE (u2)-[:${rel_type}]->(u1)`;

	try {
		const session = driver.session()
		result = await session.run(query)
		await session.close()
	} catch(error) {
		console.error(error)
	}
}
