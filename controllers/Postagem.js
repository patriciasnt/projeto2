const PostagemModel = require("../models/Postagem")


module.exports = {
  salvarNoticias: async function (req, res) {
    const novaNoticia = {
      titulo: req.fields.titulo,
      imagem: req.files.imagem.path.split("\\")[2]
    }
    const noticia = await PostagemModel.persistir(novaNoticia)

    res.redirect("/")
  },
  listarNoticias: async function (req, res) {
    const noticias = await PostagemModel.carregarTodas()
    res.render('index', noticias)
  },
  buscarNoticias: async function (titulo) {
    const noticias = await PostagemModel.buscar(titulo)
    return noticias
  }
}
