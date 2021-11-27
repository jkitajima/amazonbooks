"use strict";
const amazonbooks_1 = require("../amazonbooks");
class IndexRoute {
    /* PÁGINA INICIAL */
    async index(req, res) {
        let pageSettings = {
            layout: "landingPage"
        };
        res.render("index/index", pageSettings);
    }
    /* DIAGNÓSTICO */
    async diagnostico(req, res) {
        let catList = [];
        (async () => {
            try {
                // Creating the Books table (Book_ID, Title, Author, Comments)
                await amazonbooks_1.db.all('SELECT * from Category', async (err, rows) => {
                    if (err) {
                        throw err;
                    }
                    await rows.forEach((c) => {
                        catList.push(c);
                    });
                    res.render("index/report", { catList: catList, db: amazonbooks_1.db });
                });
            }
            catch (error) {
                throw error;
            }
        })();
    }
    /* VISÃO GERAL */
    async visao_geral(req, res) {
        let livList = [];
        (async () => {
            try {
                // Creating the Books table (Book_ID, Title, Author, Comments)
                await amazonbooks_1.db.all('SELECT autName from Author', async (err, rows) => {
                    if (err) {
                        throw err;
                    }
                    await rows.forEach((a) => {
                        livList.push(a);
                    });
                    res.render("index/general", { livList: livList });
                });
            }
            catch (error) {
                throw error;
            }
        })();
    }
    /* AUTOAJUDA */
    async autoajuda(req, res) {
        let ajuList = [];
        (async () => {
            try {
                // Creating the Books table (Book_ID, Title, Author, Comments)
                await amazonbooks_1.db.all('SELECT autName from Author', async (err, rows) => {
                    if (err) {
                        throw err;
                    }
                    await rows.forEach((a) => {
                        ajuList.push(a);
                    });
                    res.render("index/selfHelp", { ajuList: ajuList });
                });
            }
            catch (error) {
                throw error;
            }
        })();
    }
    /* INFANTIL */
    async infantil(req, res) {
        let kidList = [];
        (async () => {
            try {
                // Creating the Books table (Book_ID, Title, Author, Comments)
                await amazonbooks_1.db.all('SELECT autName from Author', async (err, rows) => {
                    if (err) {
                        throw err;
                    }
                    await rows.forEach((a) => {
                        kidList.push(a);
                    });
                    res.render("index/kids", { kidList: kidList });
                });
            }
            catch (error) {
                throw error;
            }
        })();
    }
    /* DIREITO */
    async direito(req, res) {
        let dirList = [];
        (async () => {
            try {
                // Creating the Books table (Book_ID, Title, Author, Comments)
                await amazonbooks_1.db.all('SELECT autName from Author', async (err, rows) => {
                    if (err) {
                        throw err;
                    }
                    await rows.forEach((a) => {
                        dirList.push(a);
                    });
                    res.render("index/laws", { dirList: dirList });
                });
            }
            catch (error) {
                throw error;
            }
        })();
    }
    /* HQs e MANGÁS */
    async hqs_mangas(req, res) {
        let acaList = [];
        (async () => {
            try {
                // Creating the Books table (Book_ID, Title, Author, Comments)
                await amazonbooks_1.db.all('SELECT autName from Author', async (err, rows) => {
                    if (err) {
                        throw err;
                    }
                    await rows.forEach((a) => {
                        acaList.push(a);
                    });
                    res.render("index/hqs_mangas", { acaList: acaList });
                });
            }
            catch (error) {
                throw error;
            }
        })();
    }
    /* AUTORES */
    async autores(req, res) {
        let autList = [];
        (async () => {
            try {
                await amazonbooks_1.db.all('SELECT autName from Author', async (err, rows) => {
                    if (err) {
                        throw err;
                    }
                    await rows.forEach((a) => {
                        autList.push(a);
                    });
                    res.render("index/authors", { autList: autList });
                });
            }
            catch (error) {
                throw error;
            }
        })();
    }
    /* EDITORAS */
    async editoras(req, res) {
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
                await amazonbooks_1.db.all(`
				  SELECT * from Category;`, async (err, rows) => {
                    if (err) {
                        throw err;
                    }
                    await rows.forEach((a) => {
                        pubList.push(a);
                    });
                    res.render("index/publishers", { pubList: pubList });
                });
            }
            catch (error) {
                throw error;
            }
        })();
    }
}
module.exports = IndexRoute;
//# sourceMappingURL=index.js.map