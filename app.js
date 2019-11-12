//carregando modulos
const express = require('express'); //copia do framework - tudo que for do express esta aqui
const handlebars = require('express-handlebars');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const formidableMiddleware = require('express-formidable');
const app = express();
const path = require("path"); //manipulacao de diretorios
require('dotenv').config();


//chamando o banco
require('./models/Usuarios.js');
require('./models/Postagem.js');
const Usuarios = mongoose.model('usuarios'); //tabela usuarios
const Postagem = mongoose.model('postagens'); //tabela postagem


//configuracoes
//body Parser
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
// app.use(formidableMiddleware({
//   encoding: 'utf-8',
//   uploadDir: './public/imgs/',
//   multiples: false,
//   keepExtensions: true
// }));

// initialize cookie-parser to allow us access the cookies stored in the browser.
app.use(cookieParser());

// Handlebars
app.engine('handlebars', handlebars({defaultLayout: false}));
app.set('view engine', 'handlebars');

// Mongoose
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost/cadastro").then(() => {
  console.log("MongoDB conectado");
}).catch((err) => {
  console.log("Houve um erro ao se conectar ao mongoDB: "+err);
})

// Postagens Controller
const PostagensController  = require("./controllers/Postagem")

// Public -- arquivos de img e css
app.use(express.static(path.join(__dirname,'public')));

// Inicializa o express-session para que possamos identificar os usuários logados.
app.use(session({
    key: 'user_sid',
    secret: 'WebProject',
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 600000 //10min
    }
}));

// Esse middleware vai checar se o cookie do usuário ainda está salvo no navegador e o usuário não está no server, então iremos deslogar ele.
app.use((req, res, next) => {
  if (req.cookies.user_sid && !req.session.user) {
    res.clearCookie('user_sid');
  }
  next();
});

// Função que checa os usuários logados
var sessionChecker = (req, res, next) => {
  if (req.session.user && req.cookies.user_sid) {
    res.redirect('/dashboard');
  } else {
    next();
  }
};

// Rotas

//app.use('/admin', admin)

// Rota principal - Main route
// Verifica se o usuário está logado, se estiver redireciona para o dashboard ao invés da página inicial
app.get("/", (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    res.redirect("/dashboard");
  } else {
    res.sendFile(__dirname + "/views/index.html");
  }
});

// Rota principal quando logado - Main route when loggedin
app.get("/dashboard", (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    // carregar as noticias
    PostagensController.listarNoticias(req, res);
  } else {
    res.redirect("/login");
  }
});

// Rota de login - Login route
app.route("/login")
  .get(sessionChecker, (req, res) => {
    res.sendFile(__dirname + "/views/login.html");
  });

// Rota de logout - Logout route
app.get("/logout", (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        res.clearCookie('user_sid');
        res.redirect('/');
    } else {
        res.redirect("/login");
    }
});

// Rota de busca - Search route
app.get("/buscar", async (req, res) => {
  const noticias = await PostagensController.buscarNoticias(req.query.titulo)
  res.render('buscar', noticias)
});

// Rota para postar novas noticias
app.get("/nova", (req, res) => {
  res.render('salvar')
})

// Rota que salva noticias
app.post("/noticias", (req, res) => {
  PostagensController.salvarNoticias(req, res);
})


////////////////
app.post("/singIn",function(req, res){
  // Verifica se algum dos parametros vindos da requisição é null, undefined ou vazio
  if (!req.body.senha_login || !req.body.email_login) {
    console.log("Algo deu errado");
    res.sendFile(__dirname + "/views/login.html");
  } else {
    // Busca pelo email digitado no banco
    Usuarios.where({ email: req.body.email_login }).findOne(function (err, user) {
      // Caso o usuário exista
      if (user) {
        // Compara a senha digitada com o hash do banco
        bcrypt.compare(req.body.senha_login, user.senha, function(err, result) {
          if (err) {
            console.log("Algo deu errado");
            res.sendFile(__dirname + "/views/error.html");
          }
          if (result) {
            req.session.user = user;
            // Caso a senha esteja correta, cria a seção com cookies
            // TODO:Create session with cookies
            console.log("Login realizado com sucesso!");
            res.redirect("/dashboard");
          } else {
            console.log("Senha incorreta!");
            res.sendFile(__dirname + "/views/error.html");
          }
        });
      } else {
        console.log("Usuário inexistente!");
        res.sendFile(__dirname + "/views/error.html");
      }
    });
  }
});

// Rota de cadastro - Register route
app.post("/createUser", async (req, res) => {
  // Verifica se algum dos parametros vindos da requisição é null, undefined ou vazio
  if (!req.body.nome_cad || !req.body.email_cad || !req.body.senha_cad) {
    console.log("Algo deu errado");
    res.sendFile(__dirname + "/views/error.html");
  } else {
    // Caso esteja tudo ok com os dados vindos do front, encripta a senha
    await bcrypt.hash(req.body.senha_cad, 10, function(err, hash) {
      if (err) {
        // Caso tenha ocorrido algum erro ao criar o hash de senha, redireciona para a página de erro.
        console.log("Erro ao cadastrar usuario!");
        res.sendFile(__dirname + "/views/error.html");
      }
      // Cria um objeto com as informações vindas do front
      const newUser = {
        nome: req.body.nome_cad,
        email: req.body.email_cad,
        senha: hash
      }
      // Verifica se o nome de usuário já está em uso.
      // OBS.: Não precisavamos fazer isso, o banco já faz isso, só fazemos está verificação para informar melhor o erro ao usuário.
      Usuarios.where({ nome: req.body.nome_cad }).findOne(function (err, user) {
        if (user) {
          console.log("Erro ao cadastrar usuario! Nome já em uso");
          res.sendFile(__dirname + "/views/inUseError.html");
        } else {
          // Caso esteja tudo ok com o nome de usuário, verifica se o email já está em uso.
          // OBS.: Não precisavamos fazer isso, o banco já faz isso, só fazemos está verificação para informar melhor o erro ao usuário.
          Usuarios.where({ email: req.body.email_cad }).findOne(function (err, user) {
            if (user) {
              console.log("Erro ao cadastrar usuario! Email já em uso");
              res.sendFile(__dirname + "/views/inUseError.html");
            } else {
              // Caso esteja TUDO ok, salva no banco
              new Usuarios(newUser).save().then(() => {
                console.log("Cadastro realizado com sucesso!");
                res.sendFile(__dirname + "/views/success.html");
              }).catch((err) => {
                console.log("Erro ao cadastrar usuario!");
                res.sendFile(__dirname + "/views/error.html");
              })
            }
          });
        }
      });
    });

  }
})


//outros
const PORT = process.env.PORT || 5000;
app.listen(PORT,() => {
  console.log("Servidor rodando na porta" + PORT);
})

