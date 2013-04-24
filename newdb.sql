DROP TABLE IF EXISTS test;
CREATE TABLE test (tagPath ltree, idPath ltree, classesExpr text);

CREATE INDEX tagPath_gist_idx ON test USING gist(tagPath);
CREATE INDEX idPath_gist_idx ON test USING gist(idPath);

/* Test data */
INSERT INTO test VALUES('root', 'none', '[]');
INSERT INTO test VALUES('root.html', 'none.none', '[][]');
INSERT INTO test VALUES('root.html.body', 'none.none.none', '[][][]');
INSERT INTO test VALUES('root.html.body.div', 'none.none.none.outside', '[][][][(Blue)(Green)(Red)]');
INSERT INTO test VALUES('root.html.body.div.div', 'none.none.none.outside.inside', '[][][][(Blue)(Green)(Red)][(Black)(White)]');
INSERT INTO test VALUES('root.html.body.div.p.strong', 'none.none.none.outside.none.none', '[][][][(Blue)(Green)(Red)][(text)][]');

/* actions */

/* div > div.Black */
SELECT tagPath, idPath, classesExpr FROM test
	WHERE tagPath ~ '*.div.div'
	AND classesExpr ~* '^.*\[[^\]]*\(Black\)[^\]]*\]$';

/* div.Red.Green#outside div */
SELECT tagPath, idPath, classesExpr FROM test
	WHERE tagPath ~ '*.div.*.div'
	AND idPath ~ '*.outside.*{1}'
	AND classesExpr ~* '^.*\[[^\]]*(Green)[^\]]*(Red)[^\]]*\].*$';


/*

Expected results:
        tagpath         |            idpath             |                classesexpr
------------------------+-------------------------------+--------------------------------------------
 root.html.body.div.div | none.none.none.outside.inside | [][][][(Blue)(Green)(Red)][(Black)(White)]
(1 row)

        tagpath         |            idpath             |                classesexpr
------------------------+-------------------------------+--------------------------------------------
 root.html.body.div.div | none.none.none.outside.inside | [][][][(Blue)(Green)(Red)][(Black)(White)]
(1 row)

*/
