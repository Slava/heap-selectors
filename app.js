var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , _ = require('underscore')
  , pg = require('pg')
  , CssSelectorParser = require('css-selector-parser').CssSelectorParser
  , cssParser = new CssSelectorParser()
  , util = require('util');

// setup cssParser
cssParser.registerNestingOperators('>');

var app = express();
var pgClient;

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.errorHandler());

// POST clicked elements chain, put into DB
app.post('/', function(req, res) {
	var additions = req.body || [];
	console.log(additions);

	if (additions.objects)
		additions = additions.objects;

	var insObject = {
		tagPath: 'root',
		idPath: 'none',
		classesExpr: '[]'
	};

	for (var i = 0; i < additions.length; i++) {
		var addition = additions[i];
		insObject.tagPath += '.' + addition['tagName'];
		insObject.idPath += '.' + (addition['id'] || 'none');
		insObject.classesExpr += '[' 
			+ _.reduce(addition['classes'] || [], function(result, className) {
				return className ? result + '(' + className + ')' : result;
			}, "") + ']';

		console.log('inserting %j', insObject);
		pgClient.query('INSERT INTO test VALUES($1, $2, $3);',
			[insObject.tagPath, insObject.idPath, insObject.classesExpr],
			function(err, result) {
				err && console.log('Error inserting ', insObject, ' => ', err);
				if (!err)console.log('inserted %j', insObject);
			}
		);
	}

	res.end();
});

// Parse selector and give data from DB
app.get('/', function(req, res) {
	var selector = req.query.selector;
	if (!selector) {
        res.writeHeader(200, {"Content-Type": "text/html"});  
		res.end('<form action="/" method="get"><input type="text" name="selector"></form>');
		return;
	}

	var tagPath = '*'
	  , idPath = '*'
	  , classesExpr = '^.*'; // regex

	var parsedSelector = cssParser.parse(selector).rule;
	console.log(parsedSelector);
	while (parsedSelector) {
		var tagName = parsedSelector.tagName || 'div'
		  , id = parsedSelector.id || ''
		  , classNames = parsedSelector.classNames || []
		  , nestingOperator = parsedSelector.nestingOperator;
		nestingOperator = nestingOperator === null ? ' ' : nestingOperator;

		// Update tagPath
		if (nestingOperator === ' ')
			tagPath += '.*';
		tagPath += '.' + tagName + '@';

		// Update idPath
		if (nestingOperator === ' ')
			idPath += '.*';
		if (id !== '')
			idPath += '.' + id + '@';
		else
			idPath += '.*';

		// Update classesExpr regexp
		if (nestingOperator === ' ')
			classesExpr += '.*';
		classesExpr += '\\[';

		// this delimeter is used inside square brackets []
		var innerDelim = '[^\\]]*';
		classesExpr += _.reduce(classNames, function(res, className) {
			return res + className + innerDelim;
		}, innerDelim);

		classesExpr += '\\]';

		parsedSelector = parsedSelector.rule;
	}

	// Regex ends with end-line, always, it does matter
	classesExpr += '$';

	pgClient.query(
		'SELECT * FROM test WHERE tagPath ~ $1 AND idPath ~ $2 AND classesExpr ~* $3;',
		[tagPath, idPath, classesExpr],
		function(err, result) {
			if (err) {
				console.log('Error SELECTing %s\n%s\n%s\n%j\n', tagPath, idPath, classesExpr, err);
				res.send(err, 300);
			}
			
			var rows = result.rows;
			console.log(result);
			for (var i = 0; i < rows.length; i++) {
				res.write(util.format('%s %s %s\n',
					rows[i].tagpath, rows[i].idpath, rows[i].classesexpr));
			}

			res.end(selector + " :)\n\n" + tagPath + '\n' + idPath + '\n' + classesExpr + '\n' + 

				util.format('SELECT * FROM test WHERE tagPath ~ \'%s\' AND idPath ~ \'%s\' AND classesExpr ~* \'%s\';', tagPath, idPath, classesExpr)
			);
		}
	);

});

pg.connect('pg://pgtest:12345@localhost/imslavko', function(err, client, done) {
	pgClient = client;
	http.createServer(app).listen(app.get('port'), function(){
	  console.log('Express server listening on port ' + app.get('port'));
	});
});
