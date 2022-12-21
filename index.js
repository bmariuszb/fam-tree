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
	const persons = await get_persons()
	const relations = await get_relations()
	const data = await get_data()

	res.render('index', { persons: persons, relations: relations, data: data })
})

app.get('/new-person', (req, res) => {
	res.render('new-person')
})

app.post('/new-person', async (req, res) => {
		let person = {first_name: req.body.first_name, last_name: req.body.last_name}
		await create_new_person(person)

		res.redirect('/')
})

app.get('/update-person', (req, res) => {
	const first_name = req.query.first_name
	const last_name = req.query.last_name
	res.render('update-person', { first_name: first_name, last_name: last_name })
})

app.post('/update-person', async (req, res) => {
	const first_name = req.body.first_name
	const last_name = req.body.last_name
	const new_first_name = req.body.new_first_name
	const new_last_name = req.body.new_last_name
	update_person({ first_name: first_name, last_name: last_name,
	new_first_name: new_first_name, new_last_name: new_last_name })
	res.redirect('/')
})

app.post('/delete-person', async (req, res) => {
	const first_name = req.body.first_name
	const last_name = req.body.last_name
	await delete_person( { first_name: first_name, last_name: last_name })
	res.redirect('/')
})

app.get('/new-relation', async (req, res) => {
	const persons = await get_persons()
	res.render('new-relation', { persons: persons })
})

app.post('/new-relation', async (req, res) => {
	const person1 = { first_name: req.body.person1_first_name,
		last_name: req.body.person1_last_name }
	const person2 = { first_name: req.body.person2_first_name,
		last_name: req.body.person2_last_name }
	const rel_type = req.body.relation_type

	await create_new_relation(person1, person2, rel_type)
	res.redirect('/')
})


app.get('/search-relations', async (req, res) => {
	const persons = await get_persons()
	res.render('search-relations', { persons: persons })
})

app.post('/search-relations', async (req, res) => {
	const person1 = { first_name: req.body.person1.split(' ')[0],
		last_name: req.body.person1.split(' ')[1] }
	const person2 = { first_name: req.body.person2.split(' ')[0],
		last_name: req.body.person2.split(' ')[1] }
	const persons = await get_persons()

	const [nodes, relationships] = await get_relations_between(person1, person2)
	res.render('search-relations', {data: {nodes, relationships}, persons})
})

app.get('/update-relation', (req, res) => {
	const person1 = { first_name: req.query.person1_first_name,
		last_name: req.query.person1_last_name }
	const person2 = { first_name: req.query.person2_first_name,
		last_name: req.query.person2_last_name }
	const rel_type = req.query.relation
	res.render('update-relation', { person1, person2, rel_type })
})

app.post('/update-relation', async (req, res) => {
	const person1 = { first_name: req.body.person1_first_name,
		last_name: req.body.person1_last_name }
	const person2 = { first_name: req.body.person2_first_name,
		last_name: req.body.person2_last_name }
	const rel_type = req.body.relation
	const old_rel_type = req.body.old_relation
	console.log(old_rel_type)
	await update_relation(person1, person2, rel_type, old_rel_type)

	res.redirect('/')
})

app.post('/delete-relation', async (req, res) => {
	const person1 = { first_name: req.body.person1_first_name,
		last_name: req.body.person1_last_name }
	const person2 = { first_name: req.body.person2_first_name,
		last_name: req.body.person2_last_name }
	const rel_type = req.body.relation
	await delete_relation(person1, person2, rel_type)
	res.redirect('/')
})

app.listen(3000)

async function get_persons() {
	let result = null
	try {
		const session = driver.session()
		result = await session.run(
		'match (a:Person) return a')
		await session.close()
	} catch(error) {
		console.error(error)
	}

	let persons = []
	result.records.forEach((record) => {
		id = record.get('a').identity.low
		record = record._fields[0].properties
		persons.push({ id: id,
			first_name: record.first_name,
			last_name: record.last_name })
	})
	return persons
}

async function get_relations() {
	let result = null
	try {
		const session = driver.session()
		result = await session.run(
		' MATCH (p1:Person)-[r]->(p2:Person) '
		+ 'RETURN p1.first_name, p1.last_name, r, p2.first_name, p2.last_name ')
		await session.close()
	} catch(error) {
		console.error(error)
	}

	let relations = []
	result.records.forEach((record) => {
		relations.push({ person1_first_name: record.get(0),
			person1_last_name: record.get(1),
			relation: record.get(2).type,
			person2_first_name: record.get(3),
			person2_last_name: record.get(4)
		})
	})
	return relations
}

async function create_new_person(person) {
	try {
		const session = driver.session()
		result = await session.run(
		'create (a:Person {first_name: $first_name, last_name: $last_name})', person)
		await session.close()
	} catch(error) {
		console.error(error)
	}
}

async function update_person(update_person) {
	try {
		const session = driver.session()
		result = await session.run(
		'match (a:Person {first_name: $first_name, last_name: $last_name}) '
		+ 'set a.first_name = $new_first_name, a.last_name = $new_last_name', update_person)
		await session.close()
	} catch(error) {
		console.error(error)
	}
}

async function delete_person(person) {
	try {
		const session = driver.session()
		result = await session.run(
		'match (a:Person {first_name: $first_name, last_name: $last_name}) detach delete a', person)
		await session.close()
	} catch(error) {
		console.error(error)
	}
}

async function create_new_relation(person1, person2, rel_type) {
	if (!person1 || !person2 ||
		!person1.first_name ||
		!person1.last_name ||
		!person2.first_name ||
		!person2.last_name) {
		return console.log('Invalid person data');
	}

	let query = 'MATCH (p1:Person), (p2:Person) WHERE ';
	query += `p1.first_name = "${person1.first_name}" AND p1.last_name = "${person1.last_name}" AND `;
	query += `p2.first_name = "${person2.first_name}" AND p2.last_name = "${person2.last_name}"`;
	query += ` CREATE (p2)-[:${rel_type}]->(p1)`;

	try {
		const session = driver.session()
		result = await session.run(query)
		await session.close()
	} catch(error) {
		console.error(error)
	}
}

async function update_relation(person2, person1, rel_type, old_rel_type) {
	if (!person1 || !person2 ||
		!person1.first_name ||
		!person1.last_name ||
		!person2.first_name ||
		!person2.last_name) {
		return console.log('Invalid person data');
	}

	let query = `MATCH (p1:Person { first_name:"${person1.first_name}", last_name:"${person1.last_name}" })-[r]->`;
	query += `(p2:Person { first_name:"${person2.first_name}", last_name:"${person2.last_name}" }) `;
	query += `CREATE (p1)-[r2:${rel_type}]->(p2) `;
	query += `SET r2 = r `;
	query += `WITH r `;
	query += `DELETE r `;

	try {
		const session = driver.session()
		result = await session.run(query)
		await session.close()
	} catch(error) {
		console.error(error)
	}
}

async function delete_relation(person2, person1, rel_type) {
	if (!person1 || !person2 ||
		!person1.first_name ||
		!person1.last_name ||
		!person2.first_name ||
		!person2.last_name) {
		return console.log('Invalid person data');
	}

	let query = `MATCH (p1:Person { first_name:"${person1.first_name}", last_name:"${person1.last_name}" })`;
	query += `-[r:${rel_type}]->`;
	query += `(p2:Person { first_name:"${person2.first_name}", last_name:"${person2.last_name}" }) `;
	query += `DELETE r `;

	try {
		const session = driver.session()
		result = await session.run(query)
		await session.close()
	} catch(error) {
		console.error(error)
	}
}

async function get_data() {
	let result = null
	try {
		const session = driver.session()
		result = await session.run(
		'MATCH (p1:Person)-[r]->(p2:Person) RETURN p1, r, p2')
		await session.close()
	} catch(error) {
		console.error(error)
	}

	const data = {
		nodes: [],
		relationships: []
	};

	result.records.forEach(record => {
		const p = record.get("p1").properties;

		const existingElement = data.nodes.find(obj => obj.id === record.get("p1").identity.low);
		if (!existingElement) {
			data.nodes.push({
				id: record.get("p1").identity.low,
				first_name: p.first_name,
				last_name: p.last_name
			});
		}
		data.relationships.push({
			source: record.get("p1").identity.low,
			target: record.get("p2").identity.low,
			type: record.get("r").type
		});
	});

	data.nodes = await get_persons()

	return data
}

async function get_relations_between(person1, person2) {
	let result = null
	try {
		const session = driver.session()
		result = await session.run(
		`OPTIONAL MATCH (start:Person {first_name: "${person1.first_name}", ` + 
		`last_name: "${person1.last_name}"}), (end:Person ` +
		`{first_name: "${person2.first_name}", last_name: "${person2.last_name}"}) ` +
		`MATCH path = allShortestPaths((start)-[*..20]-(end)) ` +
		`RETURN path`)
		await session.close()
	} catch(error) {
		console.error(error)
	}


	let relations = []
	let persons = []
	result.records.forEach((record) => {
		record._fields[0].segments.forEach((record) => {
			relations.push({ source: record.start.identity.low,
				target: record.end.identity.low,
				type: record.relationship.type,
			})

			const person1 = { first_name: record.start.properties.first_name,
				last_name: record.start.properties.last_name,
				id: record.start.identity.low }

			if (!persons.find(p => p.id == person1.id)) {
				persons.push(person1);
			}

			const person2 = { first_name: record.end.properties.first_name,
				last_name: record.end.properties.last_name,
				id: record.end.identity.low }

			if (!persons.find(p => p.id == person2.id)) {
				persons.push(person2);
			}
		})
	})

	return [persons, relations]
}
