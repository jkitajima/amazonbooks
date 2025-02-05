﻿import amazonbooks = require("teem");
import { db, executar, executarParam, scalar } from '../amazonbooks';
import fixDate from '../utils/fixDate';


class IndexRoute {
	/* PÁGINA INICIAL */
	public async index(req: amazonbooks.Request, res: amazonbooks.Response) {
		let pageSettings = {
			layout: "landingPage"
		};
		
		res.render("index/index", pageSettings);
	}


	/* VISÃO GERAL */
	public async visao_geral(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];
		// Cards
		let dateCat = []


		rows = await executar(`SELECT proScrapDate as date, proPosition, proName From Product WHERE catCode = 1 and proPosition <= 5 and proName IN (Select proName FROM Product WHERE proPublisher != "N/A" and catCode = 1 GROUP BY proName ORDER by count(proName) DESC LIMIT 5) ORDER by proName, proScrapDate`);
		var livrosPos = {}, seriesPos = [], datasPos = {}, categoriesPos = []

		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasPos[date]
			if(!d){
				datasPos[date] = date
				categoriesPos.push(date)
			}
		})
		categoriesPos.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesPos.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosPos[r.proName]
			if(!l){
				l = {
					name: r.proName,
					data: tempArray
				}
				livrosPos[r.proName] = l;
				seriesPos.push(l);
			}
			for (let i = 0; i < categoriesPos.length; i++){
				if(date == categoriesPos[i]){
					l.data[i] = r.proPosition
					break
				}
			}
		})

		rows = await executar(`SELECT proScrapDate as date, proReview, proName From Product WHERE catCode = 1 and proPosition <= 5 and proName IN (Select proName FROM Product WHERE proPublisher != "N/A" and catCode = 1 GROUP BY proName ORDER by count(proName) DESC LIMIT 5) ORDER by proName, proScrapDate`);
		var livrosRev = {}, seriesRev = [], datasRev = {}, categoriesRev = []
		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasRev[date]
			if(!d){
				datasRev[date] = date
				categoriesRev.push(date)
			}
		})
		
		categoriesRev.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesRev.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosRev[r.proName]
			if(!l){
				l = {
					name: r.proName,
					data: tempArray
				}
				livrosRev[r.proName] = l;
				seriesRev.push(l);
			}
			for (let i = 0; i < categoriesRev.length; i++){
				if(date == categoriesRev[i]){
					l.data[i] = r.proReview
					break
				}
			}
		})


		let pieAvgReview = [], pieAvgPrice = []
		let pieRevCategories = [], piePriCategories = []
		

		//-- ROSCA - categoria x media de preço
		rows = await executar(`SELECT c.catName, round(avg(proPrice), 2) as avgPrice FROM Product p INNER JOIN Category c ON c.catCode = p.catCode WHERE proPrice != -1 and proPrice != "N/A" GROUP BY c.catName ORDER BY avgPrice DESC LIMIT 5`)
		rows.forEach((r)=>{
			pieAvgPrice.push(r.avgPrice)
			piePriCategories.push(r.catName)
		})


		// -- ROSCA - categoria x media de reviews
		rows = await executar(`SELECT c.catName, round(avg(proReview), 2) as avgReview FROM Product p INNER JOIN Category c ON c.catCode = p.catCode WHERE proReview != "N/A" GROUP BY c.catName ORDER BY avgReview DESC LIMIT 5`)
		rows.forEach((r)=>{
			pieAvgReview.push(r.avgReview)
			pieRevCategories.push(r.catName)
		})


		let treeType = [{data: []}]

		// -- TREEMAP - tipo, freq, preço medio na cor
		rows = await executar(`SELECT proType, count(proType) as freq, round(avg(proPrice), 2) as avgPrice FROM Product WHERE proType != "not exists" and proType != "Not exists" and proType != "Not Exists" GROUP BY proType ORDER BY freq DESC`);
		rows.forEach((r)=>{
			treeType[0].data.push({
				x: r.proType,
				y: r.freq
			})
		})

		
		/* RENDER */
		res.render("index/general/general", 
		{
			dateCat: dateCat,
			total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE proCode != "N/A" AND proCode IS NOT NULL;'),
			total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
			total_authors: await scalar('SELECT COUNT(DISTINCT autCode) FROM Author WHERE autCode != "N/A" AND autCode IS NOT NULL;'),
			total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL;'),
			total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL;'),
			seriesPos: JSON.stringify(seriesPos), 
			categoriesPos: JSON.stringify(categoriesPos),
			seriesRev: JSON.stringify(seriesRev), 
			categoriesRev: JSON.stringify(categoriesRev),
			pieAvgReview: JSON.stringify(pieAvgReview),
			pieRevCategories: JSON.stringify(pieRevCategories),
			pieAvgPrice: JSON.stringify(pieAvgPrice),
			piePriCategories: JSON.stringify(piePriCategories),
			treeType: JSON.stringify(treeType)
		});
	}


	/* VISÃO GERAL - PG 2 */
	public async visao_geral_2(req: amazonbooks.Request, res: amazonbooks.Response) {
		let rows: any[];
		
		let catRevPag = {}, sumRevCat = {}, catStrPag = {}
		let seriesRevPag = [], sumAutCat = [], seriesStrPag = []


		/* CARD */
		/* Categoria com maior e menor numero de reviews */
		rows = await executar(`SELECT sum(a.proReview) as somaReview, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proReview != "N/A" GROUP BY a.catCode ORDER BY somaReview DESC;`);
		sumRevCat["max"] = {name: rows[0].catName, data: rows[0].somaReview};
		sumRevCat["min"] = {name: rows[rows.length - 1].catName, data: rows[rows.length - 1].somaReview};


		/* CARD */
		/* Categorias com maior e menor numero de autores registrados */
		rows = await executar(`SELECT count(DISTINCT autCode) as somaAutor, c.catName FROM Product p
		INNER JOIN Category c ON c.catCode = p.catCode
		GROUP BY p.catCode
		ORDER BY somaAutor DESC;`);
		sumAutCat["max"] = {name: rows[0].catName, data: rows[0].somaAutor};
		sumAutCat["min"] = {name: rows[rows.length - 1].catName, data: rows[rows.length - 1].somaAutor};


		/* DSP */
		/* review x pages /categoria */
		rows = await executar(`SELECT a.proReview, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proReview != "N/A" and a.proPages != "N/A" ORDER BY a.catCode`);	
		rows.forEach((r)=>{
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
		});


		/* DSP */
		/* star x pages /categoria */
		rows = await executar(`SELECT a.proStar, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proStar != "N/A" and a.proPages != "N/A" ORDER BY a.catCode`);
		rows.forEach((r)=>{
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
		});


		/* RENDER */
		res.render("index/general/general2", {
			total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE proCode != "N/A" AND proCode IS NOT NULL;'),
			total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
			total_authors: await scalar('SELECT COUNT(DISTINCT autCode) FROM Author WHERE autCode != "N/A" AND autCode IS NOT NULL;'),
			total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL;'),
			total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL;'),
			seriesRevPag: JSON.stringify(seriesRevPag),
			sumAutCat: sumAutCat,
			sumRevCat: sumRevCat,
			seriesStrPag: JSON.stringify(seriesStrPag)
		});
	}


	/* VISÃO GERAL - PG 3 */
	public async visao_geral_3(req: amazonbooks.Request, res: amazonbooks.Response) {
		let rows: any[];
		
		let avgPagCat = [], seriesPriPag = [], avgPriCat = [], seriesTyp = [], categoriesTyp = []
		let catPriPag = {}, catTyp = { data: []}


		/* CARD */
		/* Categorias com maior média de preço dos livros */
		rows = await executar(`SELECT round(avg(a.proPrice),2) as avgPrice, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != -1 and a.proPrice != "N/A" GROUP BY a.catCode ORDER BY avgPrice DESC;`);
		rows.forEach((r)=>{
			avgPriCat.push({name: r.catName , data: r.avgPrice })
		})
		avgPriCat["max"] = {name: rows[0].catName, data: rows[0].avgPrice};
		avgPriCat["min"] = {name: rows[rows.length - 1].catName, data: rows[rows.length - 1].avgPrice};


		/* TOP */
		/* type & Freq /categoria */
		rows = await executar(`SELECT proType, count(proType) as freq FROM Product WHERE proType != "Not Exists" and proType != "Not exists" GROUP BY proType ORDER BY freq DESC`);
		rows.forEach((r)=>{
			catTyp.data.push(r.freq);
			categoriesTyp.push(r.proType);
		});
		seriesTyp.push(catTyp);


		/* CARD */
		/* Categorias com maior e menor numero de pag medias registrados */
		rows = await executar(`SELECT round(avg(a.proPages),0) as avgPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPages != "N/A" GROUP BY a.catCode ORDER BY avgPages DESC;`);
		avgPagCat["max"] = {name: rows[0].catName, data: rows[0].avgPages};
		avgPagCat["min"] = {name: rows[rows.length - 1].catName, data: rows[rows.length - 1].avgPages};


		/* DSP */
		/* price x pages /categoria */
		rows = await executar(`SELECT a.proPrice, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proPages != "N/A" ORDER BY a.catCode`);
		rows.forEach((r)=>{
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
		});
	

		/* RENDER */
		res.render("index/general/general3", {
			total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE proCode != "N/A" AND proCode IS NOT NULL;'),
			total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
			total_authors: await scalar('SELECT COUNT(DISTINCT autCode) FROM Author WHERE autCode != "N/A" AND autCode IS NOT NULL;'),
			total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL;'),
			total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL;'),
			avgPagCat: avgPagCat,
			seriesPriPag: JSON.stringify(seriesPriPag),
			avgPriCat: avgPriCat,
			seriesTyp: JSON.stringify(seriesTyp),
			categoriesTyp: JSON.stringify(categoriesTyp)
		});
	}


	/* VISÃO GERAL - PG 4 */
	public async visao_geral_4(req: amazonbooks.Request, res: amazonbooks.Response) {
		let rows: any[];

		let seriesPriStr = [], freqProCat = [], sumPriCat = []
		let catPriStr = {}, minMaxDate = {}


		/* TOP */
		/* Freq livros distintos categoria */
		rows = await executar(`SELECT count(DISTINCT proName) as freq, c.catName from Product p INNER JOIN Category c ON c.catCode = p.catCode GROUP BY p.catCode ORDER BY freq DESC;`);
		rows.forEach((r)=>{
			freqProCat.push({name: r.catName, data: r.freq})
		})


		/* DSP */
		/* price x stars /categoria */
		rows = await executar(`SELECT a.proPrice, a.proStar, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proStar != "N/A" ORDER BY a.catCode`);
		rows.forEach((r)=>{
			var pp = catPriStr[r.catName]

			if(!pp){
				pp = {
					name: r.catName,
					data: []
				}
				catPriStr[r.catName] = pp;
				seriesPriStr.push(pp);
			}

			pp.data.push([r.proPrice, r.proStar]);
		});


		/* CARD */
		/* Categoria livro mais novos e mais velhos registrados */
		rows = await executar(`SELECT max(a.proPublishedDate) as dataMax, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" GROUP BY a.catCode ORDER BY dataMax DESC limit 1;`);
		minMaxDate["max"] = { name: rows[0].catName, data: rows[0].dataMax}
		rows = await executar(`SELECT min(a.proPublishedDate) as dataMin, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" GROUP BY a.catCode ORDER BY dataMin limit 1;`);
		minMaxDate["min"] = { name: rows[0].catName, data: rows[0].dataMin}
		

		/* TOP */
		/* Categoria preço soma de preços registrados */
		rows = await executar(`SELECT round(sum(a.proPrice), 2) as totalPrice, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 GROUP BY a.catCode ORDER BY totalPrice DESC;`);
		rows.forEach((r)=>{
			sumPriCat.push({name: r.catName, data: r.totalPrice }) 
		})


		/* RENDER */
		res.render("index/general/general4", {
			total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE proCode != "N/A" AND proCode IS NOT NULL;'),
			total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
			total_authors: await scalar('SELECT COUNT(DISTINCT autCode) FROM Author WHERE autCode != "N/A" AND autCode IS NOT NULL;'),
			total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL;'),
			total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL;'),
			seriesPriStr: JSON.stringify(seriesPriStr),
			minMaxDate: minMaxDate,
			freqProCat: JSON.stringify(freqProCat),
			sumPriCat: JSON.stringify(sumPriCat)
		});
	}


	/* AUTOAJUDA */
	public async autoajuda(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];


		/* DATE GRAPHS */
		rows = await executar('SELECT proScrapDate AS date, proPosition, proName FROM Product WHERE catCode = 2 AND proPosition <= 5 AND proName IN (SELECT proName FROM Product WHERE proPublisher != "N/A" AND catCode = 2 GROUP BY proName ORDER by COUNT(proName) DESC LIMIT 5) ORDER BY proName, proScrapDate;');

		var livrosPos = {}, seriesPos = [], datasPos = {}, categoriesPos = []

		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasPos[date]
			if(!d){
				datasPos[date] = date
				categoriesPos.push(date)
			}
		})

		categoriesPos.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesPos.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosPos[r.proName]
			if(!l){
				l = {
					name: r.proName,
					data: tempArray
				}
				livrosPos[r.proName] = l;
				seriesPos.push(l);
			}
			for (let i = 0; i < categoriesPos.length; i++){
				if(date == categoriesPos[i]){
					l.data[i] = r.proPosition
					break
				}
			}
		})

		rows = await executar('SELECT proScrapDate AS date, proReview, proName FROM Product WHERE catCode = 2 AND proPosition <= 5 AND proName IN (SELECT proName FROM Product WHERE proPublisher != "N/A" AND catCode = 2 GROUP BY proName ORDER BY COUNT(proName) DESC LIMIT 5) ORDER BY proName, proScrapDate;');
		var livrosRev = {}, seriesRev = [], datasRev = {}, categoriesRev = []
		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasRev[date]
			if(!d){
				datasRev[date] = date
				categoriesRev.push(date)
			}
		})
		
		categoriesRev.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesRev.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosRev[r.proName]
			if(!l){
				l = {
					name: r.proName,
					data: tempArray
				}
				livrosRev[r.proName] = l;
				seriesRev.push(l);
			}
			for (let i = 0; i < categoriesRev.length; i++){
				if(date == categoriesRev[i]){
					l.data[i] = r.proReview
					break
				}
			}
		})


		let pieAvgReview = [], pieAvgPrice = []
		let pieRevCategories = [], piePriCategories = []
		let treeType = [{data: []}]
		

		/* PIE */
		/* CATEGORY x AVG PRICE */
		rows = await executar('SELECT proName, ROUND(AVG(proPrice), 2) AS avgPrice FROM Product WHERE proPrice > 0 AND proPrice != "N/A" AND catCode = 2 GROUP BY proName ORDER BY avgPrice DESC LIMIT 5;')
		rows.forEach((r)=>{
			pieAvgPrice.push(r.avgPrice)
			piePriCategories.push(r.proName)
		})


		/* PIE */
		/* CATEGORY x AVG REVIEW */
		rows = await executar('SELECT proName, ROUND(AVG(proReview), 2) AS avgReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 2 GROUP BY proName ORDER BY avgReview DESC LIMIT 5;')
		rows.forEach((r)=>{
			pieAvgReview.push(r.avgReview)
			pieRevCategories.push(r.proName)
		})


		/* TREEMAP */
		rows = await executar('SELECT proType, count(proType) as freq, round(avg(proPrice), 2) as avgPrice FROM Product WHERE proType != "not exists" and proType != "Not exists" and proType != "Not Exists" AND catCode = 2 GROUP BY proType ORDER BY freq DESC;')
		rows.forEach((r)=>{
			treeType[0].data.push({
				x: r.proType,
				y: r.freq
			})
		})


		/* RENDER */
		res.render(
			'index/selfHelp/selfHelp',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 2 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 2 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 2;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 2;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 2;'),
				seriesPos: JSON.stringify(seriesPos), 
				categoriesPos: JSON.stringify(categoriesPos),
				seriesRev: JSON.stringify(seriesRev), 
				categoriesRev: JSON.stringify(categoriesRev),
				pieAvgReview: JSON.stringify(pieAvgReview),
				pieRevCategories: JSON.stringify(pieRevCategories),
				pieAvgPrice: JSON.stringify(pieAvgPrice),
				piePriCategories: JSON.stringify(piePriCategories),
				treeType: JSON.stringify(treeType)
			}
		);
	}


	/* AUTOAJUDA - PG 2 */
	public async autoajuda_2(req: amazonbooks.Request, res: amazonbooks.Response) {
		let rows: any[];

		let book_reviews_page = {}, book_stars_page = {}
		let series_reviews_page = [], series_stars_page = []


		/* DSP */
		/* REVIEWS x PAGES */
		rows = await executar('SELECT a.proReview, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proReview != "N/A" and a.proPages != "N/A" AND a.catCode = 2 ORDER BY a.catCode;');	
		
		rows.forEach((r)=> {
			var revpag = book_reviews_page[r.proName]

			if(!revpag){
				revpag = {
					name: r.proName,
					data: []
				}
				book_reviews_page[r.proName] = revpag;
				series_reviews_page.push(revpag);
			}

			revpag.data.push([r.proReview, r.proPages]);
		});


		/* DSP */
		/* STARS x PAGES */
		rows = await executar('SELECT a.proStar, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proStar != "N/A" and a.proPages != "N/A" AND c.catCode = 2 ORDER BY a.catCode;');
		
		rows.forEach((r)=> {
			var sp = book_stars_page[r.catName]

			if(!sp){
				sp = {
					name: r.catName,
					data: []
				}
				book_stars_page[r.catName] = sp;
				series_stars_page.push(sp);
			}

			sp.data.push([r.proStar, r.proPages]);
		});


		/* RENDER */
		res.render("index/selfHelp/selfHelp2", {
			total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 2 AND proCode != "N/A" AND proCode IS NOT NULL;'),
			total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 2 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
			total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 2;'),
			total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 2;'),
			total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 2;'),
			series_reviews_page: JSON.stringify(series_reviews_page),
			most_reviewed_book: await executar('SELECT proName, MAX(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 2    GROUP BY proName ORDER BY proReview DESC LIMIT 1;'),
            least_reviewed_book: await executar('SELECT proName, MIN(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 2    GROUP BY proName ORDER BY proReview ASC LIMIT 1;'),
			author_most_books: await executar(`SELECT a.autName, COUNT(DISTINCT p.proName) AS countProName FROM Author a INNER JOIN Product p ON a.autCode = p.autCode WHERE p.catCode = 2 GROUP BY a.autName ORDER BY countProName DESC LIMIT 1;`),
            most_consistent_author: await executar(`SELECT COUNT(p.autCode) AS countAutCode, a.autName FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.catCode = 2 GROUP BY p.autCode ORDER BY countAutCode DESC LIMIT 1;`),
			series_stars_page: JSON.stringify(series_stars_page)
		});
	}


	/* AUTOAJUDA - PG 3 */
	public async autoajuda_3(req: amazonbooks.Request, res: amazonbooks.Response) {
		let rows: any[];

		let hq_catTyp = { data: []};
		let hq_catPriPag = {}
		let hq_seriesTyp = [], hq_categoriesTyp = [], hq_seriesPriPag = []


		/* TOP */
		/* FREQ x TYPE */
		rows = await executar('SELECT proType, count(proType) as freq FROM Product WHERE proType != "Not Exists" and proType != "Not exists" AND catCode = 2 GROUP BY proType ORDER BY freq DESC');

		rows.forEach((r)=>{
			hq_catTyp.data.push(r.freq);
			hq_categoriesTyp.push(r.proType);
		});

		hq_seriesTyp.push(hq_catTyp);


		/* DSP */
		/* PAGES x STARS */
		rows = await executar('SELECT a.proPrice, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proPages != "N/A" AND a.catCode = 2 ORDER BY a.catCode;');

		rows.forEach((r)=>{
			var pp = hq_catPriPag[r.catName]

			if(!pp){
				pp = {
					name: r.catName,
					data: []
				}
				hq_catPriPag[r.catName] = pp;
				hq_seriesPriPag.push(pp);
			}

			pp.data.push([r.proPrice, r.proPages]);
		});
		

		/* RENDER */
		res.render("index/selfHelp/selfHelp3", {
			total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 2 AND proCode != "N/A" AND proCode IS NOT NULL;'),
			total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 2 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
			total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 2;'),
			total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 2;'),
			total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 2;'),
			hq_seriesTyp: JSON.stringify(hq_seriesTyp),
			hq_categoriesTyp: JSON.stringify(hq_categoriesTyp),
			most_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 2 GROUP BY proName ORDER BY proPages DESC LIMIT 1'),
			least_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 2 GROUP BY proName ORDER BY proPages ASC LIMIT 1'),
			most_expensive_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 2 GROUP BY proName ORDER BY proPrice DESC LIMIT 1;'),
			cheapest_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 2 GROUP BY proName ORDER BY proPrice ASC LIMIT 1;'),
			hq_seriesPriPag: JSON.stringify(hq_seriesPriPag)
		});
	}


	/* AUTOAJUDA - PG 4 */
	public async autoajuda_4(req: amazonbooks.Request, res: amazonbooks.Response) {
		let rows: any[];

		let hq_catPriStr = {}
		let hq_seriesPriStr = [], hq_sumPriCat = [], hq_most_book = []


		/* DSP */
		/* PRICE x STARS */
		rows = await executar('SELECT a.proPrice, a.proStar, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proStar != "N/A" AND a.catCode = 2 ORDER BY a.catCode;');

		rows.forEach((r)=>{
			var pp = hq_catPriStr[r.catName]

			if(!pp){
				pp = {
					name: r.catName,
					data: []
				}
				hq_catPriStr[r.catName] = pp;
				hq_seriesPriStr.push(pp);
			}

			pp.data.push([r.proPrice, r.proStar]);
		});


		/* TOP */
		/* MOST EXPENSIVE BOOKS */
		rows = await executar('SELECT proName, MAX(proPrice) AS totalPrice	FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND catCode = 2 GROUP BY proName ORDER BY totalPrice DESC LIMIT 10;');

		rows.forEach((r)=>{
			hq_sumPriCat.push({name: r.proName, data: r.totalPrice }) 
		})


		/* TOP */
		/* MOST CONSISTENT BOOKS */
		rows = await executar('SELECT proName, MAX(proReview) AS totalReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 2 GROUP BY proName ORDER BY totalReview DESC LIMIT 10;');

		rows.forEach((r)=>{
			hq_most_book.push({name: r.proName, data: r.totalReview }) 
		})
		

		/* RENDER */
		res.render("index/selfHelp/selfHelp4", {
			total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 2 AND proCode != "N/A" AND proCode IS NOT NULL;'),
			total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 2 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
			total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 2;'),
			total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 2;'),
			total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 2;'),
			hq_seriesPriStr: JSON.stringify(hq_seriesPriStr),
			newest_book: await executar('SELECT max(a.proPublishedDate) as dataMax, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 2 GROUP BY a.catCode ORDER BY dataMax DESC limit 1;'),
			oldest_book: await executar('SELECT min(a.proPublishedDate) as dataMin, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 2 GROUP BY a.catCode ORDER BY dataMin limit 1;'),
			hq_sumPriCat: JSON.stringify(hq_sumPriCat),
			hq_most_book: JSON.stringify(hq_most_book)
		});
	}


	/* INFANTIL */
	public async infantil(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];


		/* DATE GRAPHS */
		rows = await executar('SELECT proScrapDate AS date, proPosition, proName FROM Product WHERE catCode = 13 AND proPosition <= 5 AND proName IN (SELECT proName FROM Product WHERE proPublisher != "N/A" AND catCode = 13 GROUP BY proName ORDER by COUNT(proName) DESC LIMIT 5) ORDER BY proName, proScrapDate;');

		var livrosPos = {}, seriesPos = [], datasPos = {}, categoriesPos = []

		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasPos[date]
			if(!d){
				datasPos[date] = date
				categoriesPos.push(date)
			}
		})

		categoriesPos.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesPos.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosPos[r.proName]
			if(!l){
				l = {
					name: r.proName,
					data: tempArray
				}
				livrosPos[r.proName] = l;
				seriesPos.push(l);
			}
			for (let i = 0; i < categoriesPos.length; i++){
				if(date == categoriesPos[i]){
					l.data[i] = r.proPosition
					break
				}
			}
		})

		rows = await executar('SELECT proScrapDate AS date, proReview, proName FROM Product WHERE catCode = 13 AND proPosition <= 5 AND proName IN (SELECT proName FROM Product WHERE proPublisher != "N/A" AND catCode = 13 GROUP BY proName ORDER BY COUNT(proName) DESC LIMIT 5) ORDER BY proName, proScrapDate;');
		var livrosRev = {}, seriesRev = [], datasRev = {}, categoriesRev = []
		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasRev[date]
			if(!d){
				datasRev[date] = date
				categoriesRev.push(date)
			}
		})
		
		categoriesRev.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesRev.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosRev[r.proName]
			if(!l){
				l = {
					name: r.proName,
					data: tempArray
				}
				livrosRev[r.proName] = l;
				seriesRev.push(l);
			}
			for (let i = 0; i < categoriesRev.length; i++){
				if(date == categoriesRev[i]){
					l.data[i] = r.proReview
					break
				}
			}
		})


		let pieAvgReview = [], pieAvgPrice = []
		let pieRevCategories = [], piePriCategories = []
		let treeType = [{data: []}]
		

		/* PIE */
		/* CATEGORY x AVG PRICE */
		rows = await executar('SELECT proName, ROUND(AVG(proPrice), 2) AS avgPrice FROM Product WHERE proPrice > 0 AND proPrice != "N/A" AND catCode = 13 GROUP BY proName ORDER BY avgPrice DESC LIMIT 5;')
		rows.forEach((r)=>{
			pieAvgPrice.push(r.avgPrice)
			piePriCategories.push(r.proName)
		})


		/* PIE */
		/* CATEGORY x AVG REVIEW */
		rows = await executar('SELECT proName, ROUND(AVG(proReview), 2) AS avgReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 13 GROUP BY proName ORDER BY avgReview DESC LIMIT 5;')
		rows.forEach((r)=>{
			pieAvgReview.push(r.avgReview)
			pieRevCategories.push(r.proName)
		})


		/* TREEMAP */
		rows = await executar('SELECT proType, count(proType) as freq, round(avg(proPrice), 2) as avgPrice FROM Product WHERE proType != "not exists" and proType != "Not exists" and proType != "Not Exists" AND catCode = 13 GROUP BY proType ORDER BY freq DESC;')
		rows.forEach((r)=>{
			treeType[0].data.push({
				x: r.proType,
				y: r.freq
			})
		})


		/* RENDER */
		res.render(
			'index/kids/kids',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 13 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 13 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 13;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 13;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 13;'),
				seriesPos: JSON.stringify(seriesPos), 
				categoriesPos: JSON.stringify(categoriesPos),
				seriesRev: JSON.stringify(seriesRev), 
				categoriesRev: JSON.stringify(categoriesRev),
				pieAvgReview: JSON.stringify(pieAvgReview),
				pieRevCategories: JSON.stringify(pieRevCategories),
				pieAvgPrice: JSON.stringify(pieAvgPrice),
				piePriCategories: JSON.stringify(piePriCategories),
				treeType: JSON.stringify(treeType)
			}
		);
	}


	/* INFANTIL - PG 2 */
	public async infantil_2(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];

		let book_reviews_page = {}, book_stars_page = {}
		let series_reviews_page = [], series_stars_page = []


		/* DSP */
		/* REVIEWS x PAGES */
		rows = await executar('SELECT a.proReview, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proReview != "N/A" and a.proPages != "N/A" AND a.catCode = 13 ORDER BY a.catCode;');	
		
		rows.forEach((r)=> {
			var revpag = book_reviews_page[r.proName]

			if(!revpag){
				revpag = {
					name: r.proName,
					data: []
				}
				book_reviews_page[r.proName] = revpag;
				series_reviews_page.push(revpag);
			}

			revpag.data.push([r.proReview, r.proPages]);
		});


		/* DSP */
		/* STARS x PAGES */
		rows = await executar('SELECT a.proStar, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proStar != "N/A" and a.proPages != "N/A" AND c.catCode = 13 ORDER BY a.catCode;');
		
		rows.forEach((r)=> {
			var sp = book_stars_page[r.catName]

			if(!sp){
				sp = {
					name: r.catName,
					data: []
				}
				book_stars_page[r.catName] = sp;
				series_stars_page.push(sp);
			}

			sp.data.push([r.proStar, r.proPages]);
		});


		/* RENDER */
		res.render(
			'index/kids/kids2',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 13 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 13 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 13;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 13;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 13;'),
				series_reviews_page: JSON.stringify(series_reviews_page),
				most_reviewed_book: await executar('SELECT proName, MAX(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 13    GROUP BY proName ORDER BY proReview DESC LIMIT 1;'),
                least_reviewed_book: await executar('SELECT proName, MIN(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 13    GROUP BY proName ORDER BY proReview ASC LIMIT 1;'),
				author_most_books: await executar(`SELECT a.autName, COUNT(DISTINCT p.proName) AS countProName FROM Author a INNER JOIN Product p ON a.autCode = p.autCode WHERE p.catCode = 13 GROUP BY a.autName ORDER BY countProName DESC LIMIT 1;`),
                most_consistent_author: await executar(`SELECT COUNT(p.autCode) AS countAutCode, a.autName FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.catCode = 13 GROUP BY p.autCode ORDER BY countAutCode DESC LIMIT 1;`),
				series_stars_page: JSON.stringify(series_stars_page)
			}
		);
	}


	/* INFANTIL - PG 3 */
	public async infantil_3(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];

		let hq_catTyp = { data: []};
		let hq_categoriesTyp = [], hq_seriesTyp = [], hq_seriesPriPag = []
		let hq_catPriPag = {}


		/* TOP */
		/* FREQ x TYPE */
		rows = await executar('SELECT proType, count(proType) as freq FROM Product WHERE proType != "Not Exists" and proType != "Not exists" AND catCode = 13 GROUP BY proType ORDER BY freq DESC');

		rows.forEach((r)=>{
			hq_catTyp.data.push(r.freq);
			hq_categoriesTyp.push(r.proType);
		});

		hq_seriesTyp.push(hq_catTyp);
		

		/* DSP */
		/* PRICE x PAGES */
		rows = await executar('SELECT a.proPrice, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proPages != "N/A" AND a.catCode = 13 ORDER BY a.catCode;');

		rows.forEach((r)=>{
			var pp = hq_catPriPag[r.catName]

			if(!pp){
				pp = {
					name: r.catName,
					data: []
				}
				hq_catPriPag[r.catName] = pp;
				hq_seriesPriPag.push(pp);
			}

			pp.data.push([r.proPrice, r.proPages]);
		});


		/* RENDER */
		res.render(
			'index/kids/kids3',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 13 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 13 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 13;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 13;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 13;'),
				hq_seriesTyp: JSON.stringify(hq_seriesTyp),
				hq_categoriesTyp: JSON.stringify(hq_categoriesTyp),
				most_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 13 GROUP BY proName ORDER BY proPages DESC LIMIT 1'),
				least_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 13 GROUP BY proName ORDER BY proPages ASC LIMIT 1'),
				most_expensive_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 13 GROUP BY proName ORDER BY proPrice DESC LIMIT 1;'),
				cheapest_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 13 GROUP BY proName ORDER BY proPrice ASC LIMIT 1;'),
				hq_seriesPriPag: JSON.stringify(hq_seriesPriPag)
			}
		);
	}


	/* INFANTIL - PG 4 */
	public async infantil_4(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];

		let hq_catPriStr = {}
		let hq_seriesPriStr = [], hq_sumPriCat = [], hq_most_book = []


		/* DSP */
		/* PRICE x STARS */
		rows = await executar('SELECT a.proPrice, a.proStar, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proStar != "N/A" AND a.catCode = 13 ORDER BY a.catCode;');

		rows.forEach((r)=>{
			var pp = hq_catPriStr[r.catName]

			if(!pp){
				pp = {
					name: r.catName,
					data: []
				}
				hq_catPriStr[r.catName] = pp;
				hq_seriesPriStr.push(pp);
			}

			pp.data.push([r.proPrice, r.proStar]);
		});


		/* TOP */
		/* MOST EXPENSIVE BOOKS */
		rows = await executar('SELECT proName, MAX(proPrice) AS totalPrice	FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND catCode = 13 GROUP BY proName ORDER BY totalPrice DESC LIMIT 10;');

		rows.forEach((r)=>{
			hq_sumPriCat.push({name: r.proName, data: r.totalPrice }) 
		})


		/* TOP */
		/* MOST CONSISTENT BOOKS */
		rows = await executar('SELECT proName, MAX(proReview) AS totalReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 13 GROUP BY proName ORDER BY totalReview DESC LIMIT 10;');

		rows.forEach((r)=>{
			hq_most_book.push({name: r.proName, data: r.totalReview }) 
		})


		/* RENDER */
		res.render(
			'index/kids/kids4',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 13 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 13 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 13;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 13;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 13;'),
				hq_seriesPriStr: JSON.stringify(hq_seriesPriStr),
				newest_book: await executar('SELECT max(a.proPublishedDate) as dataMax, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 13 GROUP BY a.catCode ORDER BY dataMax DESC limit 1;'),
				oldest_book: await executar('SELECT min(a.proPublishedDate) as dataMin, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 13 GROUP BY a.catCode ORDER BY dataMin limit 1;'),
				hq_sumPriCat: JSON.stringify(hq_sumPriCat),
				hq_most_book: JSON.stringify(hq_most_book)
			}
		);
	}


	/* DIREITO */
	public async direito(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];


		/* DATE GRAPHS */
		rows = await executar('SELECT proScrapDate AS date, proPosition, proName FROM Product WHERE catCode = 5 AND proPosition <= 5 AND proName IN (SELECT proName FROM Product WHERE proPublisher != "N/A" AND catCode = 5 GROUP BY proName ORDER by COUNT(proName) DESC LIMIT 5) ORDER BY proName, proScrapDate;');

		var livrosPos = {}, seriesPos = [], datasPos = {}, categoriesPos = []

		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasPos[date]
			if(!d){
				datasPos[date] = date
				categoriesPos.push(date)
			}
		})

		categoriesPos.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesPos.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosPos[r.proName]
			if(!l){
				l = {
					name: r.proName,
					data: tempArray
				}
				livrosPos[r.proName] = l;
				seriesPos.push(l);
			}
			for (let i = 0; i < categoriesPos.length; i++){
				if(date == categoriesPos[i]){
					l.data[i] = r.proPosition
					break
				}
			}
		})

		rows = await executar('SELECT proScrapDate AS date, proReview, proName FROM Product WHERE catCode = 5 AND proPosition <= 5 AND proName IN (SELECT proName FROM Product WHERE proPublisher != "N/A" AND catCode = 5 GROUP BY proName ORDER BY COUNT(proName) DESC LIMIT 5) ORDER BY proName, proScrapDate;');
		var livrosRev = {}, seriesRev = [], datasRev = {}, categoriesRev = []
		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasRev[date]
			if(!d){
				datasRev[date] = date
				categoriesRev.push(date)
			}
		})
		
		categoriesRev.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesRev.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosRev[r.proName]
			if(!l){
				l = {
					name: r.proName,
					data: tempArray
				}
				livrosRev[r.proName] = l;
				seriesRev.push(l);
			}
			for (let i = 0; i < categoriesRev.length; i++){
				if(date == categoriesRev[i]){
					l.data[i] = r.proReview
					break
				}
			}
		})


		let pieAvgReview = [], pieAvgPrice = []
		let pieRevCategories = [], piePriCategories = []
		let treeType = [{data: []}]
		

		/* PIE */
		/* CATEGORY x AVG PRICE */
		rows = await executar('SELECT proName, ROUND(AVG(proPrice), 2) AS avgPrice FROM Product WHERE proPrice > 0 AND proPrice != "N/A" AND catCode = 5 GROUP BY proName ORDER BY avgPrice DESC LIMIT 5;')
		rows.forEach((r)=>{
			pieAvgPrice.push(r.avgPrice)
			piePriCategories.push(r.proName)
		})


		/* PIE */
		/* CATEGORY x AVG REVIEW */
		rows = await executar('SELECT proName, ROUND(AVG(proReview), 2) AS avgReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 5 GROUP BY proName ORDER BY avgReview DESC LIMIT 5;')
		rows.forEach((r)=>{
			pieAvgReview.push(r.avgReview)
			pieRevCategories.push(r.proName)
		})


		/* TREEMAP */
		rows = await executar('SELECT proType, count(proType) as freq, round(avg(proPrice), 2) as avgPrice FROM Product WHERE proType != "not exists" and proType != "Not exists" and proType != "Not Exists" AND catCode = 5 GROUP BY proType ORDER BY freq DESC;')
		rows.forEach((r)=>{
			treeType[0].data.push({
				x: r.proType,
				y: r.freq
			})
		})


		/* RENDER */
		res.render(
			'index/laws/laws',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 5 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 5 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 5;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 5;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 5;'),
				most_reviewed_book: await executar('SELECT proName, MAX(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 5    GROUP BY proName ORDER BY proReview DESC LIMIT 1;'),
                least_reviewed_book: await executar('SELECT proName, MIN(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 5    GROUP BY proName ORDER BY proReview ASC LIMIT 1;'),
                author_most_books: await executar(`SELECT a.autName, COUNT(DISTINCT p.proName) AS countProName FROM Author a INNER JOIN Product p ON a.autCode = p.autCode WHERE p.catCode = 5 GROUP BY a.autName ORDER BY countProName DESC LIMIT 1;`),
                most_consistent_author: await executar(`SELECT COUNT(p.autCode) AS countAutCode, a.autName FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.catCode = 5 GROUP BY p.autCode ORDER BY countAutCode DESC LIMIT 1;`),
				most_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 5 GROUP BY proName ORDER BY proPages DESC LIMIT 1'),
				least_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 5 GROUP BY proName ORDER BY proPages ASC LIMIT 1'),
				most_expensive_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 5 GROUP BY proName ORDER BY proPrice DESC LIMIT 1;'),
				cheapest_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 5 GROUP BY proName ORDER BY proPrice ASC LIMIT 1;'),
				newest_book: await executar('SELECT max(a.proPublishedDate) as dataMax, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 5 GROUP BY a.catCode ORDER BY dataMax DESC limit 1;'),
				oldest_book: await executar('SELECT min(a.proPublishedDate) as dataMin, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 5 GROUP BY a.catCode ORDER BY dataMin limit 1;'),
				seriesPos: JSON.stringify(seriesPos), 
				categoriesPos: JSON.stringify(categoriesPos),
				seriesRev: JSON.stringify(seriesRev), 
				categoriesRev: JSON.stringify(categoriesRev),
				pieAvgReview: JSON.stringify(pieAvgReview),
				pieRevCategories: JSON.stringify(pieRevCategories),
				pieAvgPrice: JSON.stringify(pieAvgPrice),
				piePriCategories: JSON.stringify(piePriCategories),
				treeType: JSON.stringify(treeType)
			}
		);
	}


	/* DIREITO - PG 2 */
	public async direito_2(req: amazonbooks.Request, res: amazonbooks.Response) {
		let rows: any[];

		let book_reviews_page = {}, book_stars_page = {}
		let series_reviews_page = [], series_stars_page = []


		/* DSP */
		/* REVIEWS x PAGES */
		rows = await executar('SELECT a.proReview, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proReview != "N/A" and a.proPages != "N/A" AND a.catCode = 5 ORDER BY a.catCode;');	
		
		rows.forEach((r)=> {
			var revpag = book_reviews_page[r.proName]

			if(!revpag){
				revpag = {
					name: r.proName,
					data: []
				}
				book_reviews_page[r.proName] = revpag;
				series_reviews_page.push(revpag);
			}

			revpag.data.push([r.proReview, r.proPages]);
		});


		/* DSP */
		/* STARS x PAGES */
		rows = await executar('SELECT a.proStar, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proStar != "N/A" and a.proPages != "N/A" AND c.catCode = 5 ORDER BY a.catCode;');
		
		rows.forEach((r)=> {
			var sp = book_stars_page[r.catName]

			if(!sp){
				sp = {
					name: r.catName,
					data: []
				}
				book_stars_page[r.catName] = sp;
				series_stars_page.push(sp);
			}

			sp.data.push([r.proStar, r.proPages]);
		});


		/* RENDER */
		res.render("index/laws/laws2", {
			total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 5 AND proCode != "N/A" AND proCode IS NOT NULL;'),
			total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 5 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
			total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 5;'),
			total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 5;'),
			total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 5;'),
			series_reviews_page: JSON.stringify(series_reviews_page),
			most_reviewed_book: await executar('SELECT proName, MAX(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 5    GROUP BY proName ORDER BY proReview DESC LIMIT 1;'),
            least_reviewed_book: await executar('SELECT proName, MIN(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 5    GROUP BY proName ORDER BY proReview ASC LIMIT 1;'),
			author_most_books: await executar(`SELECT a.autName, COUNT(DISTINCT p.proName) AS countProName FROM Author a INNER JOIN Product p ON a.autCode = p.autCode WHERE p.catCode = 5 GROUP BY a.autName ORDER BY countProName DESC LIMIT 1;`),
            most_consistent_author: await executar(`SELECT COUNT(p.autCode) AS countAutCode, a.autName FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.catCode = 5 GROUP BY p.autCode ORDER BY countAutCode DESC LIMIT 1;`),
			series_stars_page: JSON.stringify(series_stars_page)
		});
	}


	/* DIREITO - PG 3 */
	public async direito_3(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];

		let hq_catTyp = { data: []};
		let hq_categoriesTyp = [], hq_seriesTyp = [], hq_seriesPriPag = []
		let hq_catPriPag = {}


		/* TOP */
		/* FREQ x TYPE */
		rows = await executar('SELECT proType, count(proType) as freq FROM Product WHERE proType != "Not Exists" and proType != "Not exists" AND catCode = 5 GROUP BY proType ORDER BY freq DESC');

		rows.forEach((r)=>{
			hq_catTyp.data.push(r.freq);
			hq_categoriesTyp.push(r.proType);
		});

		hq_seriesTyp.push(hq_catTyp);
		

		/* DSP */
		/* PRICE x PAGES */
		rows = await executar('SELECT a.proPrice, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proPages != "N/A" AND a.catCode = 5 ORDER BY a.catCode;');

		rows.forEach((r)=>{
			var pp = hq_catPriPag[r.catName]

			if(!pp){
				pp = {
					name: r.catName,
					data: []
				}
				hq_catPriPag[r.catName] = pp;
				hq_seriesPriPag.push(pp);
			}

			pp.data.push([r.proPrice, r.proPages]);
		});


		/* RENDER */
		res.render(
			'index/laws/laws3',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 5 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 5 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 5;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 5;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 5;'),
				hq_seriesTyp: JSON.stringify(hq_seriesTyp),
				hq_categoriesTyp: JSON.stringify(hq_categoriesTyp),
				most_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 5 GROUP BY proName ORDER BY proPages DESC LIMIT 1'),
				least_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 5 GROUP BY proName ORDER BY proPages ASC LIMIT 1'),
				most_expensive_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 5 GROUP BY proName ORDER BY proPrice DESC LIMIT 1;'),
				cheapest_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 5 GROUP BY proName ORDER BY proPrice ASC LIMIT 1;'),
				hq_seriesPriPag: JSON.stringify(hq_seriesPriPag)
			}
		);
	}


	/* DIREITO - PG 4 */
	public async direito_4(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];

		let hq_catPriStr = {}
		let hq_seriesPriStr = [], hq_sumPriCat = [], hq_most_book = []


		/* DSP */
		/* PRICE x STARS */
		rows = await executar('SELECT a.proPrice, a.proStar, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proStar != "N/A" AND a.catCode = 5 ORDER BY a.catCode;');

		rows.forEach((r)=>{
			var pp = hq_catPriStr[r.catName]

			if(!pp){
				pp = {
					name: r.catName,
					data: []
				}
				hq_catPriStr[r.catName] = pp;
				hq_seriesPriStr.push(pp);
			}

			pp.data.push([r.proPrice, r.proStar]);
		});


		/* TOP */
		/* MOST EXPENSIVE BOOKS */
		rows = await executar('SELECT proName, MAX(proPrice) AS totalPrice	FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND catCode = 5 GROUP BY proName ORDER BY totalPrice DESC LIMIT 10;');

		rows.forEach((r)=>{
			hq_sumPriCat.push({name: r.proName, data: r.totalPrice }) 
		})


		/* TOP */
		/* MOST CONSISTENT BOOKS */
		rows = await executar('SELECT proName, MAX(proReview) AS totalReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 5 GROUP BY proName ORDER BY totalReview DESC LIMIT 10;');

		rows.forEach((r)=>{
			hq_most_book.push({name: r.proName, data: r.totalReview }) 
		})


		/* RENDER */
		res.render(
			'index/laws/laws4',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 5 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 5 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 5;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 5;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 5;'),
				hq_seriesPriStr: JSON.stringify(hq_seriesPriStr),
				newest_book: await executar('SELECT max(a.proPublishedDate) as dataMax, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 5 GROUP BY a.catCode ORDER BY dataMax DESC limit 1;'),
				oldest_book: await executar('SELECT min(a.proPublishedDate) as dataMin, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 5 GROUP BY a.catCode ORDER BY dataMin limit 1;'),
				hq_sumPriCat: JSON.stringify(hq_sumPriCat),
				hq_most_book: JSON.stringify(hq_most_book)
			}
		);
	}


	/* HQs e MANGÁS */
	public async hqs_mangas(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];


		/* DATE GRAPHS */
		rows = await executar('SELECT proScrapDate AS date, proPosition, proName FROM Product WHERE catCode = 4 AND proPosition <= 5 AND proName IN (SELECT proName FROM Product WHERE proPublisher != "N/A" AND catCode = 4 GROUP BY proName ORDER by COUNT(proName) DESC LIMIT 5) ORDER BY proName, proScrapDate;');

		var livrosPos = {}, seriesPos = [], datasPos = {}, categoriesPos = []

		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasPos[date]
			if(!d){
				datasPos[date] = date
				categoriesPos.push(date)
			}
		})

		categoriesPos.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesPos.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosPos[r.proName]
			if(!l){
				l = {
					name: r.proName,
					data: tempArray
				}
				livrosPos[r.proName] = l;
				seriesPos.push(l);
			}
			for (let i = 0; i < categoriesPos.length; i++){
				if(date == categoriesPos[i]){
					l.data[i] = r.proPosition
					break
				}
			}
		})

		rows = await executar('SELECT proScrapDate AS date, proReview, proName FROM Product WHERE catCode = 4 AND proPosition <= 5 AND proName IN (SELECT proName FROM Product WHERE proPublisher != "N/A" AND catCode = 4 GROUP BY proName ORDER BY COUNT(proName) DESC LIMIT 5) ORDER BY proName, proScrapDate;');
		var livrosRev = {}, seriesRev = [], datasRev = {}, categoriesRev = []
		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasRev[date]
			if(!d){
				datasRev[date] = date
				categoriesRev.push(date)
			}
		})
		
		categoriesRev.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesRev.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosRev[r.proName]
			if(!l){
				l = {
					name: r.proName,
					data: tempArray
				}
				livrosRev[r.proName] = l;
				seriesRev.push(l);
			}
			for (let i = 0; i < categoriesRev.length; i++){
				if(date == categoriesRev[i]){
					l.data[i] = r.proReview
					break
				}
			}
		})


		let pieAvgReview = [], pieAvgPrice = []
		let pieRevCategories = [], piePriCategories = []
		let treeType = [{data: []}]
		

		/* PIE */
		/* CATEGORY x AVG PRICE */
		rows = await executar('SELECT proName, ROUND(AVG(proPrice), 2) AS avgPrice FROM Product WHERE proPrice > 0 AND proPrice != "N/A" AND catCode = 4 GROUP BY proName ORDER BY avgPrice DESC LIMIT 5;')
		rows.forEach((r)=>{
			pieAvgPrice.push(r.avgPrice)
			piePriCategories.push(r.proName)
		})


		/* PIE */
		/* CATEGORY x AVG REVIEW */
		rows = await executar('SELECT proName, ROUND(AVG(proReview), 2) AS avgReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 4 GROUP BY proName ORDER BY avgReview DESC LIMIT 5;')
		rows.forEach((r)=>{
			pieAvgReview.push(r.avgReview)
			pieRevCategories.push(r.proName)
		})


		/* TREEMAP */
		rows = await executar('SELECT proType, count(proType) as freq, round(avg(proPrice), 2) as avgPrice FROM Product WHERE proType != "not exists" and proType != "Not exists" and proType != "Not Exists" AND catCode = 4 GROUP BY proType ORDER BY freq DESC;')
		rows.forEach((r)=>{
			treeType[0].data.push({
				x: r.proType,
				y: r.freq
			})
		})


		/* RENDER */
		res.render(
			'index/hqs_mangas/hqs_mangas',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 4 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 4 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 4;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 4;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 4;'),
				most_reviewed_book: await executar('SELECT proName, MAX(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 4    GROUP BY proName ORDER BY proReview DESC LIMIT 1;'),
                least_reviewed_book: await executar('SELECT proName, MIN(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 4    GROUP BY proName ORDER BY proReview ASC LIMIT 1;'),
                author_most_books: await executar(`SELECT a.autName, COUNT(DISTINCT p.proName) AS countProName FROM Author a INNER JOIN Product p ON a.autCode = p.autCode WHERE p.catCode = 4 GROUP BY a.autName ORDER BY countProName DESC LIMIT 1;`),
                most_consistent_author: await executar(`SELECT COUNT(p.autCode) AS countAutCode, a.autName FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.catCode = 4 GROUP BY p.autCode ORDER BY countAutCode DESC LIMIT 1;`),
				most_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 4 GROUP BY proName ORDER BY proPages DESC LIMIT 1'),
				least_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 4 GROUP BY proName ORDER BY proPages ASC LIMIT 1'),
				most_expensive_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 4 GROUP BY proName ORDER BY proPrice DESC LIMIT 1;'),
				cheapest_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 4 GROUP BY proName ORDER BY proPrice ASC LIMIT 1;'),
				newest_book: await executar('SELECT max(a.proPublishedDate) as dataMax, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 4 GROUP BY a.catCode ORDER BY dataMax DESC limit 1;'),
				oldest_book: await executar('SELECT min(a.proPublishedDate) as dataMin, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 4 GROUP BY a.catCode ORDER BY dataMin limit 1;'),
				seriesPos: JSON.stringify(seriesPos), 
				categoriesPos: JSON.stringify(categoriesPos),
				seriesRev: JSON.stringify(seriesRev), 
				categoriesRev: JSON.stringify(categoriesRev),
				pieAvgReview: JSON.stringify(pieAvgReview),
				pieRevCategories: JSON.stringify(pieRevCategories),
				pieAvgPrice: JSON.stringify(pieAvgPrice),
				piePriCategories: JSON.stringify(piePriCategories),
				treeType: JSON.stringify(treeType)
			}
		);
	}


	/* HQs e MANGÁS - PG 2 */
	public async hqs_mangas_2(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];

		let book_reviews_page = {}, book_stars_page = {}
		let series_reviews_page = [], series_stars_page = []


		/* DSP */
		/* REVIEWS x PAGES */
		rows = await executar('SELECT a.proReview, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proReview != "N/A" and a.proPages != "N/A" AND a.catCode = 4 ORDER BY a.catCode;');	
		
		rows.forEach((r)=> {
			var revpag = book_reviews_page[r.proName]

			if(!revpag){
				revpag = {
					name: r.proName,
					data: []
				}
				book_reviews_page[r.proName] = revpag;
				series_reviews_page.push(revpag);
			}

			revpag.data.push([r.proReview, r.proPages]);
		});


		/* DSP */
		/* STARS x PAGES */
		rows = await executar('SELECT a.proStar, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proStar != "N/A" and a.proPages != "N/A" AND c.catCode = 4 ORDER BY a.catCode;');
		
		rows.forEach((r)=> {
			var sp = book_stars_page[r.catName]

			if(!sp){
				sp = {
					name: r.catName,
					data: []
				}
				book_stars_page[r.catName] = sp;
				series_stars_page.push(sp);
			}

			sp.data.push([r.proStar, r.proPages]);
		});


		/* RENDER */
		res.render(
			'index/hqs_mangas/hqs_mangas2',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 4 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 4 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 4;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 4;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 4;'),
				series_reviews_page: JSON.stringify(series_reviews_page),
				most_reviewed_book: await executar('SELECT proName, MAX(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 4    GROUP BY proName ORDER BY proReview DESC LIMIT 1;'),
                least_reviewed_book: await executar('SELECT proName, MIN(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 4    GROUP BY proName ORDER BY proReview ASC LIMIT 1;'),
				author_most_books: await executar(`SELECT a.autName, COUNT(DISTINCT p.proName) AS countProName FROM Author a INNER JOIN Product p ON a.autCode = p.autCode WHERE p.catCode = 4 GROUP BY a.autName ORDER BY countProName DESC LIMIT 1;`),
                most_consistent_author: await executar(`SELECT COUNT(p.autCode) AS countAutCode, a.autName FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.catCode = 4 GROUP BY p.autCode ORDER BY countAutCode DESC LIMIT 1;`),
				series_stars_page: JSON.stringify(series_stars_page)
			}
		);
	}


	/* HQs e MANGÁS - PG 3 */
	public async hqs_mangas_3(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];

		let hq_catTyp = { data: []};
		let hq_categoriesTyp = [], hq_seriesTyp = [], hq_seriesPriPag = []
		let hq_catPriPag = {}


		/* TOP */
		/* FREQ x TYPE */
		rows = await executar('SELECT proType, count(proType) as freq FROM Product WHERE proType != "Not Exists" and proType != "Not exists" AND catCode = 4 GROUP BY proType ORDER BY freq DESC');

		rows.forEach((r)=>{
			hq_catTyp.data.push(r.freq);
			hq_categoriesTyp.push(r.proType);
		});

		hq_seriesTyp.push(hq_catTyp);
		

		/* DSP */
		/* PRICE x PAGES */
		rows = await executar('SELECT a.proPrice, a.proPages, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proPages != "N/A" AND a.catCode = 4 ORDER BY a.catCode;');

		rows.forEach((r)=>{
			var pp = hq_catPriPag[r.catName]

			if(!pp){
				pp = {
					name: r.catName,
					data: []
				}
				hq_catPriPag[r.catName] = pp;
				hq_seriesPriPag.push(pp);
			}

			pp.data.push([r.proPrice, r.proPages]);
		});


		/* RENDER */
		res.render(
			'index/hqs_mangas/hqs_mangas3',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 4 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 4 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 4;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 4;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 4;'),
				hq_seriesTyp: JSON.stringify(hq_seriesTyp),
				hq_categoriesTyp: JSON.stringify(hq_categoriesTyp),
				most_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 4 GROUP BY proName ORDER BY proPages DESC LIMIT 1'),
				least_pages: await executar('SELECT proName, proPages FROM Product WHERE proPages != "N/A" AND proPages IS NOT NULL AND catCode = 4 GROUP BY proName ORDER BY proPages ASC LIMIT 1'),
				most_expensive_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 4 GROUP BY proName ORDER BY proPrice DESC LIMIT 1;'),
				cheapest_book: await executar('SELECT proName, proPrice FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND proPrice > 0 AND catCode = 4 GROUP BY proName ORDER BY proPrice ASC LIMIT 1;'),
				hq_seriesPriPag: JSON.stringify(hq_seriesPriPag)
			}
		);
	}


	/* HQs e MANGÁS - PG 4 */
	public async hqs_mangas_4(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];

		let hq_catPriStr = {}
		let hq_seriesPriStr = [], hq_sumPriCat = [], hq_most_book = []


		/* DSP */
		/* PRICE x STARS */
		rows = await executar('SELECT a.proPrice, a.proStar, c.catName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proStar != "N/A" AND a.catCode = 4 ORDER BY a.catCode;');

		rows.forEach((r)=>{
			var pp = hq_catPriStr[r.catName]

			if(!pp){
				pp = {
					name: r.catName,
					data: []
				}
				hq_catPriStr[r.catName] = pp;
				hq_seriesPriStr.push(pp);
			}

			pp.data.push([r.proPrice, r.proStar]);
		});


		/* TOP */
		/* MOST EXPENSIVE BOOKS */
		rows = await executar('SELECT proName, MAX(proPrice) AS totalPrice	FROM Product WHERE proPrice != "N/A" AND proPrice IS NOT NULL AND catCode = 4 GROUP BY proName ORDER BY totalPrice DESC LIMIT 10;');

		rows.forEach((r)=>{
			hq_sumPriCat.push({name: r.proName, data: r.totalPrice }) 
		})


		/* TOP */
		/* MOST CONSISTENT BOOKS */
		rows = await executar('SELECT proName, MAX(proReview) AS totalReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL AND catCode = 4 GROUP BY proName ORDER BY totalReview DESC LIMIT 10;');

		rows.forEach((r)=>{
			hq_most_book.push({name: r.proName, data: r.totalReview }) 
		})


		/* RENDER */
		res.render(
			'index/hqs_mangas/hqs_mangas4',
			{
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE catCode = 4 AND proCode != "N/A" AND proCode IS NOT NULL;'),
				total_sum: await scalar('SELECT ROUND(SUM(proPrice), 2) AS sumPrice FROM (SELECT proName, proPrice FROM Product WHERE catCode = 4 AND proPrice > 0 AND proPrice IS NOT NULL AND proPrice != "N/A" GROUP BY proName);'),
				total_authors: await scalar('SELECT COUNT(DISTINCT p.autCode) FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.autCode != "N/A" AND p.autCode IS NOT NULL AND p.catCode = 4;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL AND catCode = 4;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND catCode = 4;'),
				hq_seriesPriStr: JSON.stringify(hq_seriesPriStr),
				newest_book: await executar('SELECT max(a.proPublishedDate) as dataMax, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 4 GROUP BY a.catCode ORDER BY dataMax DESC limit 1;'),
				oldest_book: await executar('SELECT min(a.proPublishedDate) as dataMin, a.proName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Category c ON c.catCode = a.catCode WHERE a.proPublishedDate != "N/A" AND a.catCode = 4 GROUP BY a.catCode ORDER BY dataMin limit 1;'),
				hq_sumPriCat: JSON.stringify(hq_sumPriCat),
				hq_most_book: JSON.stringify(hq_most_book)
			}
		);
	}


	/* AUTORES */
	public async autores(req: amazonbooks.Request, res: amazonbooks.Response) {
		let rows: any[];

		let mostAvgStar = {data: 0, name: ""}
		let avgPriAut = []

		let pieAvgReview = []
		let pieRevCategories = []


		/* PIE */
		/* CATEGORY x AVG REVIEW */
		rows = await executar('SELECT a.autName, ROUND(AVG(p.proReview), 2) AS avgReview FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.proReview != "N/A" AND p.proReview IS NOT NULL GROUP BY a.autName ORDER BY avgReview DESC LIMIT 5;')
		rows.forEach((r)=>{
			pieAvgReview.push(r.avgReview)
			pieRevCategories.push(r.autName)
		})


		/* DATE GRAPH - REVIEW */
		rows = await executar('SELECT proScrapDate AS date, proReview, autCode FROM Product WHERE proPosition <= 5 AND autCode IN (SELECT autCode FROM Product WHERE proPublisher != "N/A" GROUP BY autCode ORDER BY COUNT(autCode) DESC LIMIT 5) ORDER BY autCode, proScrapDate;');
		var livrosRev = {}, seriesRev = [], datasRev = {}, categoriesRev = []
		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasRev[date]
			if(!d){
				datasRev[date] = date
				categoriesRev.push(date)
			}
		})
		
		categoriesRev.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesRev.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosRev[r.autCode]
			if(!l){
				l = {
					name: r.autCode,
					data: tempArray
				}
				livrosRev[r.autCode] = l;
				seriesRev.push(l);
			}
			for (let i = 0; i < categoriesRev.length; i++){
				if(date == categoriesRev[i]){
					l.data[i] = r.proReview
					break
				}
			}
		})


		/* CARD */
		/* maior estrela entre os top 10 consistentes */
		rows = await executar(`SELECT autName, sum(a.proReview) as reviews, round(avg(a.proStar),2) as avgStars FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Author at ON at.autCode = a.autCode WHERE a.proReview != "N/A" and a.proStar != "N/A" GROUP by a.autCode ORDER BY reviews DESC LIMIT 10;`);
		rows.forEach((r)=>{
			if(r.avgStars > mostAvgStar.data){
				mostAvgStar.data = r.avgStars
				mostAvgStar.name = r.autName
			}
		})


		/* TOP */
		/* Autor preço médio de preços registrados */
		rows = await executar(`SELECT round(avg(a.proPrice), 2) as avgPrice, at.autName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Author at ON at.autCode = a.autCode WHERE a.proPrice != "N/A" and a.proPrice != -1 GROUP BY a.autCode ORDER BY avgPrice DESC LIMIT 10;`);
		rows.forEach((r)=>{
			avgPriAut.push({name: r.autName, data: r.avgPrice }) 
		})

		
		/* TREEMAP */
		let treeType = [{data: []}]
		rows = await executar(`SELECT a.autName, count(p.autCode) as freq FROM Product p INNER JOIN Author a ON a.autCode = p.autCode GROUP BY p.autCode ORDER BY freq DESC LIMIT 10;`)
		rows.forEach((r)=>{
			treeType[0].data.push({
				x: r.autName,
				y: r.freq
			})
		})


		/* RENDER */
		res.render('index/authors/authors', {
			mostConsistent: await executar(`Select a.autName, count(p.autCode) as freq FROM Product p INNER JOIN Author a ON a.autCode = p.autCode GROUP BY p.autCode ORDER by freq DESC LIMIT 1`),
			mostReviewed: await executar(`SELECT autName, sum(a.proReview) as reviews FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Author at ON at.autCode = a.autCode WHERE a.proReview != "N/A" GROUP by a.autCode ORDER BY reviews DESC LIMIT 1;`),
			mostAvgStar: mostAvgStar,
			mostPages: await executar(`SELECT round(avg(a.proPages),0) as avgPages, at.autName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Author at ON at.autCode = a.autCode WHERE  a.proPages != "N/A" GROUP BY a.autCode ORDER BY avgPages DESC LIMIT 1;`),
			leastPages: await executar(`SELECT round(avg(a.proPages),0) as avgPages, at.autName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Author at ON at.autCode = a.autCode WHERE  a.proPages != "N/A" GROUP BY a.autCode ORDER BY avgPages LIMIT 1;`),
			avgPriAut: JSON.stringify(avgPriAut),
			pieAvgReview: JSON.stringify(pieAvgReview),
			pieRevCategories: JSON.stringify(pieRevCategories),
			seriesRev: JSON.stringify(seriesRev), 
			categoriesRev: JSON.stringify(categoriesRev),
			treeType: JSON.stringify(treeType)
		})
	}


	/* AUTORES - PG 2 */
	public async autores_2(req: amazonbooks.Request, res: amazonbooks.Response) {
		let rows: any[];

		let avgPagAut = [], autRev = [], freqAut = [];


		/* TOP */
		/* Freq autor pos */
		rows = await executar(`Select a.autName, count(p.autCode) as freq FROM Product p INNER JOIN Author a ON a.autCode = p.autCode GROUP BY p.autCode ORDER by freq DESC LIMIT 10`);
		rows.forEach((r)=>{
			freqAut.push({name: r.autName, data: r.freq }) 
		})
		

		/* TOP */
		/* Autor media pag registrados */
		rows = await executar(`SELECT round(avg(a.proPages),2) as avgPages, at.autName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Author at ON at.autCode = a.autCode WHERE  a.proPages != "N/A" GROUP BY a.autCode ORDER BY avgPages DESC LIMIT 10;`);
		rows.forEach((r)=>{
			avgPagAut.push({name: r.autName, data: r.avgPages }) 
		})

		
		/* TOP */
		/* autor x review */
		rows = await executar(`SELECT autName, sum(a.proReview) as reviews FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Author at ON at.autCode = a.autCode WHERE a.proReview != "N/A" GROUP by a.autCode ORDER BY reviews DESC LIMIT 10;`);
		rows.forEach((r)=>{
			autRev.push({name: r.autName, data: r.reviews }) 
		})


		/* RENDER */
		res.render("index/authors/authors2", {
			mostExpensive: await executar(`SELECT round(avg(a.proPrice),2) as avgPrice, at.autName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Author at ON at.autCode = a.autCode WHERE a.proPrice != -1 and a.proPrice != "N/A" GROUP BY a.autCode ORDER BY avgPrice DESC LIMIT 1;`),
			leastExpensive: await executar(`SELECT round(avg(a.proPrice),2) as avgPrice, at.autName FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode INNER JOIN Author at ON at.autCode = a.autCode WHERE a.proPrice != -1 and a.proPrice != "N/A" GROUP BY a.autCode ORDER BY avgPrice LIMIT 1;`),
			freqAut: JSON.stringify(freqAut),
			avgPagAut: JSON.stringify(avgPagAut),
			autRev: JSON.stringify(autRev),
			more_published: await executar('SELECT a.autName, COUNT(DISTINCT p.proName) AS countProName FROM Author a INNER JOIN Product p ON a.autCode = p.autCode GROUP BY a.autName ORDER BY countProName DESC;')
		});
	}


	/* EDITORAS */
	public async editoras(req: amazonbooks.Request, res: amazonbooks.Response){
		let rows: any[];

		let mostAvgStar = {data: 0, name: ""}
		let pubPri = []


		let pieAvgReview = []
		let pieRevCategories = []


		/* PIE */
		/* CATEGORY x AVG REVIEW */
		rows = await executar('SELECT proPublisher, ROUND(AVG(proReview), 2) AS avgReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL GROUP BY proPublisher ORDER BY avgReview DESC LIMIT 5;')
		rows.forEach((r)=>{
			pieAvgReview.push(r.avgReview)
			pieRevCategories.push(r.proPublisher)
		})


		/* DATE GRAPH - REVIEW */
		rows = await executar('SELECT proScrapDate AS date, proReview, proPublisher FROM Product WHERE proPosition <= 5 AND proPublisher IN (SELECT proPublisher FROM Product WHERE proPublisher != "N/A" GROUP BY proPublisher ORDER BY COUNT(proPublisher) DESC LIMIT 5) ORDER BY proPublisher, proScrapDate;');
		var livrosRev = {}, seriesRev = [], datasRev = {}, categoriesRev = []
		rows.forEach((r)=>{
			var date = fixDate(r.date)
			let d = datasRev[date]
			if(!d){
				datasRev[date] = date
				categoriesRev.push(date)
			}
		})
		
		categoriesRev.sort()
		rows.forEach((r)=>{
			var tempArray = Array(categoriesRev.length).fill(null)
			var date = fixDate(r.date)
			var l = livrosRev[r.proPublisher]
			if(!l){
				l = {
					name: r.proPublisher,
					data: tempArray
				}
				livrosRev[r.proPublisher] = l;
				seriesRev.push(l);
			}
			for (let i = 0; i < categoriesRev.length; i++){
				if(date == categoriesRev[i]){
					l.data[i] = r.proReview
					break
				}
			}
		})


		/* CARD */
		/* maior estrela entre os top 10 consistentes */
		rows = await executar(`SELECT a.proPublisher, sum(a.proReview) as reviews, round(avg(a.proStar),2) as avgStars FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode WHERE a.proReview != "N/A" and a.proStar != "N/A" and a.proPublisher != "N/A" GROUP by a.proPublisher ORDER BY reviews DESC LIMIT 10;`);
		rows.forEach((r)=>{
			if(r.avgStars > mostAvgStar.data){
				mostAvgStar.data = r.avgStars
				mostAvgStar.name = r.proPublisher
			}
		})


		/* TOP */
		/* pri x pub */
		rows = await executar(`SELECT round(avg(a.proPrice), 2) as avgPrice, a.proPublisher FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proPublisher != "N/A" GROUP BY a.proPublisher ORDER BY avgPrice DESC LIMIT 10;`);
		rows.forEach((r)=>{
			pubPri.push({name: r.proPublisher, data: r.avgPrice }) 
		})


		/* TREEMAP */
		let treeType = [{data: []}]
		rows = await executar(`SELECT proPublisher, count(proPublisher) as freq FROM Product WHERE proPublisher != "N/A" GROUP BY proPublisher ORDER BY freq DESC LIMIT 10;`);
		rows.forEach((r)=>{
			treeType[0].data.push({
				x: r.proPublisher,
				y: r.freq
			})
		})
		
		
		/* RENDER */
		res.render("index/publishers/publishers", {
			mostConsistent: await executar(`Select proPublisher, count(proPublisher) as freq FROM Product WHERE proPublisher != "N/A" GROUP BY proPublisher ORDER by freq DESC LIMIT 1;`),
			mostReviewed: await executar(`SELECT proPublisher, sum(a.proReview) as reviews FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode WHERE a.proReview != "N/A" and a.proPublisher != "N/A" GROUP by proPublisher ORDER BY reviews DESC LIMIT 1;`),
			mostAvgStar: mostAvgStar,
			pubPri: JSON.stringify(pubPri),
			pieAvgReview: JSON.stringify(pieAvgReview),
			pieRevCategories: JSON.stringify(pieRevCategories),
			seriesRev: JSON.stringify(seriesRev), 
			categoriesRev: JSON.stringify(categoriesRev),
			treeType: JSON.stringify(treeType)
		});
	}


	/* EDITORAS - PG 2 */
	public async editoras_2(req: amazonbooks.Request, res: amazonbooks.Response) {
		let rows: any[];
		
		let pubFreq = [], pubRev = [];


		/* TOP */
		/* pub x freq */
		rows = await executar(`Select proPublisher, count(proPublisher) as freq FROM Product p WHERE proPublisher != "N/A" GROUP BY proPublisher ORDER by freq DESC LIMIT 10`);
		rows.forEach((r)=>{
			pubFreq.push({name: r.proPublisher, data: r.freq }) 
		})


		/* TOP */
		/* pub x review */
		rows = await executar(`SELECT a.proPublisher, sum(a.proReview) as reviews FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode WHERE a.proReview != "N/A" and a.proPublisher != "N/A" GROUP by a.proPublisher ORDER BY reviews DESC LIMIT 10;`);
		rows.forEach((r)=>{
			pubRev.push({name: r.proPublisher, data: r.reviews }) 
		})


		/* RENDER */
		res.render("index/publishers/publishers2", {
			pubFreq: JSON.stringify(pubFreq),
			mostExpensive: await executar(`SELECT round(avg(a.proPrice),2) as avgPrice, a.proPublisher FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode WHERE a.proPrice != -1 and a.proPrice != "N/A" and a.proPublisher != "N/A" GROUP BY a.proPublisher ORDER BY avgPrice DESC LIMIT 1;`),
			leastExpensive: await executar(`SELECT round(avg(a.proPrice), 2) as avgPrice, a.proPublisher FROM Product a INNER JOIN (SELECT proName, MAX(proCode) as proCode FROM Product GROUP BY proName) AS b ON a.proName = b.proName and a.proCode = b.proCode WHERE a.proPrice != "N/A" and a.proPrice != -1 and a.proPublisher != "N/A" GROUP BY a.proPublisher ORDER BY avgPrice LIMIT 1;`),
			pubRev: JSON.stringify(pubRev),
			most_reviewed_publisher: await executar('SELECT proPublisher, MAX(proReview) AS proReview FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND proReview != "N/A" AND proReview IS NOT NULL GROUP BY proPublisher ORDER BY proReview DESC LIMIT 1;'),
			highest_avg_reviews_publisher: await executar('SELECT proPublisher, ROUND(AVG(proReview), 2) AS proReview FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL AND proReview != "N/A" AND proReview IS NOT NULL GROUP BY proPublisher ORDER BY proReview DESC LIMIT 1;'),
			more_published: await executar('SELECT proPublisher,  COUNT(DISTINCT proName) AS countProName FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL GROUP BY proPublisher ORDER BY countProName DESC LIMIT 1;')
		});
	}


	/* RELATÓRIO */
	public async relatorio(req: amazonbooks.Request, res: amazonbooks.Response) {
		res.render(
			'index/report',
			{
				earliest_date: await scalar('SELECT MIN(proScrapDate) FROM Product;'),
				latest_date: await scalar('SELECT MAX(proScrapDate) FROM Product;'),
				total_records: await scalar('SELECT COUNT(proCode) FROM Product WHERE proCode != "N/A" AND proCode IS NOT NULL;'),
				total_authors: await scalar('SELECT COUNT(DISTINCT autCode) FROM Author WHERE autCode != "N/A" AND autCode IS NOT NULL;'),
				total_books: await scalar('SELECT COUNT(DISTINCT proName) FROM Product WHERE proName != "N/A" AND proName IS NOT NULL;'),
				total_publishers: await scalar('SELECT COUNT(DISTINCT proPublisher) FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL;'),
				total_categories: await scalar('SELECT COUNT(DISTINCT catName) FROM Category;'),
				total_reviews: await scalar('SELECT SUM(proReview) FROM (SELECT proName, MAX(proReview) AS proReview FROM Product WHERE proReview != "N/A" GROUP BY proName);'),
				total_pages: await scalar('SELECT SUM(proPages) FROM (SELECT proName, proPages AS proPages FROM Product WHERE proPages IS NOT NULL AND proPages != "N/A" GROUP BY proName);'),
				avg_price: await scalar('SELECT ROUND(AVG(proPrice), 2) FROM (SELECT proName, proPrice FROM Product GROUP BY proName);'),
				max_price: await executar('SELECT p.proName, a.autName, MAX(p.proPrice) AS proPrice FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.proPrice != "N/A" AND p.proPrice IS NOT NULL;'),
				min_price: await executar('SELECT p.proName, a.autName, MIN(p.proPrice) AS proPrice FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.proPrice != "N/A" AND p.proPrice IS NOT NULL AND p.proPrice > 0;'),
				avg_stars: await scalar('SELECT ROUND(AVG(proStar), 2) FROM (SELECT proName, proStar FROM Product WHERE proStar != "N/A" AND proStar IS NOT NULL GROUP BY proName);'),
				max_reviews_perbook: await executar('SELECT p.proName, a.autName, MAX(p.proReview) AS proReview FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.proReview != "N/A" AND p.proReview IS NOT NULL;'),
				avg_reviews_perbook: await scalar('SELECT CAST(ROUND(AVG(proReview)) AS INTEGER) FROM (SELECT proName, MAX(proReview) AS proReview FROM Product WHERE proReview != "N/A" AND proReview IS NOT NULL GROUP BY proName);'),
				longest_book: await executar('SELECT p.proName, a.autName, MAX(p.proPages) AS proPages FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.proPages != "N/A" AND p.proPages IS NOT NULL;'),
				shortest_book: await executar('SELECT p.proName, a.autName, MIN(p.proPages) AS proPages FROM Product p INNER JOIN Author a ON p.autCode = a.autCode WHERE p.proPages != "N/A" AND p.proPages IS NOT NULL AND p.proPages > 1;'),
				most_consistent_author: await executar('SELECT a.autName, COUNT(p.autCode) AS autCode FROM Author a INNER JOIN Product p ON a.autCode = p.autCode GROUP BY a.autName ORDER BY COUNT(p.autCode) DESC LIMIT 1;'),
				oldest_book: await executar('SELECT a.autName, p.proName, MIN(p.proPublishedDate) AS proPublishedDate FROM Author a INNER join Product P ON a.autCode = p.autCode;'),
				avg_publishing_date: await scalar('SELECT CAST(ROUND(AVG(proPublishedDate), 1) AS INTEGER) FROM Product;'),
				most_consistent_book: await executar('SELECT p.proName, a.autName, COUNT(p.proCode) AS proCode FROM Product p INNER JOIN Author a ON a.autCode = p.autCode GROUP BY proName ORDER BY proCode DESC LIMIT 1;'),
				most_consistent_publisher: await executar('SELECT proPublisher, COUNT(proPublisher) AS proPublisherCount FROM Product WHERE proPublisher != "N/A" AND proPublisher IS NOT NULL GROUP BY proPublisher ORDER BY COUNT(proPublisher) DESC LIMIT 1;')
			}
		);
	}


	/* PÁGINA DE BUSCAS */
	// @amazonbooks.http.post()
	public async buscar(req: amazonbooks.Request, res: amazonbooks.Response) {
		

		res.render("index/searchPage", {
			

		});
	}


	/* ROTA DE BUSCAS */
	@amazonbooks.http.post()
	public async rotaBuscas(req: amazonbooks.Request, res:amazonbooks.Response) {
		let scrapDate = 'SELECT proScrapDate AS date, proPosition, proName FROM Product WHERE proName IN (SELECT proName FROM Product WHERE proPublisher != "N/A" AND proName LIKE ? GROUP BY proName ORDER by COUNT(proName)) ORDER BY proName, proScrapDate;';
		let response = await executarParam(scrapDate, [req.body.query])
		res.json(response)

		// let sql2 = 'SELECT * FROM Product WHERE proName = ? GROUP BY proName;';
		// let response2 = await executarParam(sql2, [req.body.query])
		// res.json(response2)
	}
}


export = IndexRoute;
