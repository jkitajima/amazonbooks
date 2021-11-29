﻿import amazonbooks = require("teem");
import { db, executar, scalar } from '../amazonbooks';
import Category from '../models/Category';
import Author from '../models/Author';
import Product from '../models/Product';

class IndexRoute {
	/* PÁGINA INICIAL */
	public async index(req: amazonbooks.Request, res: amazonbooks.Response) {
		let pageSettings = {
			layout: "landingPage"
		};
		
		res.render("index/index", pageSettings);
	}


	/* DIAGNÓSTICO */
	public async diagnostico(req: amazonbooks.Request, res: amazonbooks.Response) {
		res.render(
			'index/report',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product;'),
				total_books: await scalar('SELECT COUNT(DISTINCT autCode) FROM Author;'),
				total_authors: await scalar('SELECT COUNT(DISTINCT proName) FROM Product;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product;'),
				total_categories: await scalar('SELECT COUNT(DISTINCT catName) FROM Category;')
			}
		);
	}


	/* VISÃO GERAL */
	public async visao_geral(req: amazonbooks.Request, res: amazonbooks.Response){
		// Cards
		let sumRevCat = {}, sumAutCatMax = {}, sumAutCatMin = {}, avgPagCat = {}

		/// Graficos
		let seriesRevPag = [], seriesStrPag = [], seriesPriPag = [], seriesTyp = []
		let catRevPag = {}, catStrPag = {}, catPriPag = {}, catTyp = { data: []}
		let categoriesTyp = []

		
		await db.get(`SELECT sum(a.proReview) as somaReview, c.catName
		FROM Product a
		INNER JOIN (SELECT proName,
					MAX(proCode) as proCode
					FROM Product 
					GROUP BY proName) AS b
		ON a.proName = b.proName and a.proCode = b.proCode
		INNER JOIN Category c ON c.catCode = a.catCode
		WHERE a.proReview != "N/A"
		GROUP BY a.catCode
		ORDER BY somaReview DESC;`, async(err, row)=>{
				sumRevCat["data"] = row.somaReview;
				sumRevCat["name"] = row.catName;
		})

		await db.all(`SELECT count(DISTINCT autCode) as somaAutor, c.catName FROM Product p
		INNER JOIN Category c ON c.catCode = p.catCode
		GROUP BY p.catCode
		ORDER BY somaAutor DESC;`, async(err, rows)=>{
				sumAutCatMax["name"] = rows[0].catName
				sumAutCatMax["data"] = rows[0].somaAutor
				sumAutCatMin["name"] = rows[rows.length - 1].catName
				sumAutCatMin["data"] = rows[rows.length - 1].somaAutor
		})

		await db.all(`SELECT round(avg(a.proPages),0) as avgPages, c.catName
		FROM Product a
		INNER JOIN (SELECT proName,
					MAX(proCode) as proCode
					FROM Product 
					GROUP BY proName) AS b
		ON a.proName = b.proName and a.proCode = b.proCode
		INNER JOIN Category c ON c.catCode = a.catCode
		WHERE a.proPages != "N/A"
		GROUP BY a.catCode
		ORDER BY avgPages DESC;`, async(err, rows)=>{
				sumAutCatMax["name"] = rows[0].catName
				sumAutCatMax["data"] = rows[0].somaAutor
				sumAutCatMin["name"] = rows[rows.length - 1].catName
				sumAutCatMin["data"] = rows[rows.length - 1].somaAutor
		})

		await db.all(`SELECT a.proReview, a.proPages, c.catName
		FROM Product a
		INNER JOIN (SELECT proName,
					MAX(proCode) as proCode
					FROM Product 
					GROUP BY proName) AS b
		ON a.proName = b.proName and a.proCode = b.proCode
		INNER JOIN Category c ON c.catCode = a.catCode
		WHERE a.proReview != "N/A" and a.proPages != "N/A"
		ORDER BY a.catCode`, async (err, rows) =>{
			if(err){
				throw err;
			}
			await rows.forEach((r)=>{
				var c = catRevPag[r.catName]

				if(!c){
					c = {
						name: r.catName,
						data: []
					}
					catRevPag[r.catName] = c;
					seriesRevPag.push(c);
				}

				c.data.push([r.proReview, r.proPages]);
			})
			
		})	

		await db.all(`SELECT a.proStar, a.proPages, c.catName
		FROM Product a
		INNER JOIN (SELECT proName,
					MAX(proCode) as proCode
					FROM Product 
					GROUP BY proName) AS b
		ON a.proName = b.proName and a.proCode = b.proCode
		INNER JOIN Category c ON c.catCode = a.catCode
		WHERE a.proStar != "N/A" and a.proPages != "N/A"
		ORDER BY a.catCode`, async (err, rows) =>{
			if(err){
				throw err;
			}
			await rows.forEach((r)=>{
				var sp = catStrPag[r.catName]

				if(!sp){
					sp = {
						name: r.catName,
						data: []
					}
					catStrPag[r.catName] = sp;
					seriesStrPag.push(sp);
				}

				sp.data.push([r.proStar, r.proPages]);
			})
		})

		await db.all(`SELECT a.proPrice, a.proPages, c.catName
		FROM Product a
		INNER JOIN (SELECT proName,
					MAX(proCode) as proCode
					FROM Product 
					GROUP BY proName) AS b
		ON a.proName = b.proName and a.proCode = b.proCode
		INNER JOIN Category c ON c.catCode = a.catCode
		WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proPages != "N/A"
		ORDER BY a.catCode`, async (err, rows) =>{
			if(err){
				throw err;
			}
			await rows.forEach((r)=>{
				var pp = catPriPag[r.catName]

				if(!pp){
					pp = {
						name: r.catName,
						data: []
					}
					catPriPag[r.catName] = pp;
					seriesPriPag.push(pp);
				}

				pp.data.push([r.proPrice, r.proPages]);
			})
			
		})

		await db.all(`SELECT proType, count(proType) as freq
		FROM Product
		WHERE proType != "Not Exists" and proType != "Not exists"
		GROUP BY proType
		ORDER BY freq DESC`, async (err, rows) =>{
			if(err){
				throw err;
			}
			await rows.forEach((r)=>{
				catTyp.data.push(r.freq);
				categoriesTyp.push(r.proType);
			})
			seriesTyp.push(catTyp);
			
			res.render("index/general", {sumAutCatMax: sumAutCatMax, sumAutCatMin: sumAutCatMin, sumRevCat: sumRevCat, seriesRevPag: JSON.stringify(seriesRevPag), seriesStrPag: JSON.stringify(seriesStrPag), seriesPriPag: JSON.stringify(seriesPriPag), seriesTyp: JSON.stringify(seriesTyp), categoriesTyp: JSON.stringify(categoriesTyp)});
		})
	}


	/* AUTOAJUDA */
	public async autoajuda(req: amazonbooks.Request, res: amazonbooks.Response){
		let ajuList = [];

		res.render("index/selfHelp")
	}


	/* INFANTIL */
	public async infantil(req: amazonbooks.Request, res: amazonbooks.Response){
		let kidList = [];

		(async () => {
			try {
			  	// Creating the Books table (Book_ID, Title, Author, Comments)
			  	await db.all('SELECT autName from Author', async (err, rows) =>{
					if(err){
						throw err;
					}
					await rows.forEach((a)=>{
						kidList.push(a)
					})
					res.render("index/kids", {kidList: kidList});
				})	
			}
			catch (error) { throw error; }
		  })();
	}


	/* DIREITO */
	public async direito(req: amazonbooks.Request, res: amazonbooks.Response){
		let dirList = [];

		(async () => {
			try {
			  	// Creating the Books table (Book_ID, Title, Author, Comments)
			  	await db.all('SELECT autName from Author', async (err, rows) =>{
					if(err){
						throw err;
					}
					await rows.forEach((a)=>{
						dirList.push(a)
					})
					res.render("index/laws", {dirList: dirList});
				})	
			}
			catch (error) { throw error; }
		  })();
	}


	/* HQs e MANGÁS */
	public async hqs_mangas(req: amazonbooks.Request, res: amazonbooks.Response){
		let acaList = [];

		(async () => {
			try {
			  	// Creating the Books table (Book_ID, Title, Author, Comments)
			  	await db.all('SELECT autName from Author', async (err, rows) =>{
					if(err){
						throw err;
					}
					await rows.forEach((a)=>{
						acaList.push(a)
					})
					res.render("index/hqs_mangas", {acaList: acaList});
				})	
			}
			catch (error) { throw error; }
		  })();
	}


	/* AUTORES */
	public async autores(req: amazonbooks.Request, res: amazonbooks.Response) {
		let autList = [];

		(async () => {
			try {
			  	await db.all('SELECT autName from Author', async (err, rows) =>{
					if(err){
						throw err;
					}
					await rows.forEach((a)=>{
						autList.push(a)
					})
					res.render("index/authors", {autList: autList});
				})	
			}
			catch (error) { throw error; }
		  })();


	}


	/* EDITORAS */
	public async editoras(req: amazonbooks.Request, res: amazonbooks.Response){
		let pubList = [];

		(async () => {
			try {
			  	// Creating the Books table (Book_ID, Title, Author, Comments)
			  	// await db.all(`
				//   SELECT proName, proPrice, proPublisher, c.catName 
				// 	FROM Product p 
				// 	INNER JOIN Category c 
				// 	INNER JOIN Product_Category pc 
				// 	WHERE proPublisher = "Todolivro" and p.proCode = pc.proCode and c.catCode = pc.catCode ;`, 
				//   async (err, rows) =>{
				// 	if(err){
				// 		throw err;
				// 	}
				// 	await rows.forEach((a)=>{
				// 		pubList.push(a)
				// 	})
				// 	res.render("index/publishers", {pubList: pubList});
				// })

				await db.all(`
				  SELECT * from Category;`, 
				  async (err, rows) =>{
					if(err){
						throw err;
					}
					await rows.forEach((a)=>{
						pubList.push(a)
					})
					res.render("index/publishers", {pubList: pubList});
				})
			}
			catch (error) { throw error; }
		  })();
	}
}

export = IndexRoute;
