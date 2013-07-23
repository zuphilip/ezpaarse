/*jslint node: true, maxlen: 100, maxerr: 50, indent: 2 */
'use strict';

//
// Command used to validate editor platform knowledge base
//

var util          = require('util');
var fs            = require('fs');
var csv           = require('csv');
var byline        = require('byline');
var csvextractor  = require('../../lib/csvextractor.js');
var ridchecker    = require('../../lib/rid-syntax-checker.js');
var jsonwriter    = require('../../lib/outputformats/csv.js');

var linenb = 0;         // lines in CSV file
var records = [];       // records from CSV file
var errorRecords = [];  // error records with comments
var errorFields = [];   // keys of error records for csv writing
var columns = {};       // result objet
var ridsyntaxerrors = 0; // rids errors

// in text mode sorting function
function sortObject(obj) {
  var arr = [];
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      arr.push({
        'key': prop,
        'value': obj[prop]
      });
    }
  }
  arr.sort(function (a, b) { return a.value - b.value; });
  return arr; // returns array
}

// in text mode sorting function (reverse)
function sortObjectR(obj) {
  var arr = [];
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      arr.push({
        'key': prop,
        'value': obj[prop]
      });
    }
  }
  arr.sort(function (a, b) { return b.value - a.value; });
  return arr; // returns array
}

// for csv output purpose
Array.prototype.uniqueMerge = function (a) {
  a = a ? a : [];
  for (var nonDuplicates = [], i = 0, l = a.length; i < l; ++i) {
    if (this.indexOf(a[i]) === -1) {
      nonDuplicates.push(a[i]);
    }
  }
  return this.concat(nonDuplicates);
};

/*
* Command used to parse a csv source into json or csv
*/

exports.pkbValidator = function () {
  var optimist = require('optimist')
    .usage('Check a platform knowledge base file.' +
      '\n  Usage: $0 [-svc] pkb_file1 [pkb_file2]')
    .alias('csv', 'c')
    .describe('csv', 'If provided, the error-output will be a csv.')
    .alias('silent', 's')
    .describe('silent',
              'If provided, no output generated.')
    .alias('verbose', 'v')
    .describe('verbose',
              'show stats of checking.')
  var argv = optimist.argv;
  var files = [];

  // show usage if --help option is used
  if (argv.help || argv.h) {
    optimist.showHelp();
    process.exit(0);
  }

  argv._.forEach(function (file) {
    if (fs.existsSync(file) && file.match(/.pkb.csv/)) {
      files.push(file);
    } else {
      console.error(file + " : seems not to be a pkb file (no .pkb.csv extension)");
    }
  });

  if (!files.length) {
    console.error("No pkb files to validate");
    process.exit(1);
  }

  csvextractor.extract(files, null, function (records) {
    var fields = [];
    //console.log(records);
    records.forEach(function (record, index) {
      var rid = false;   /* check minimum vital informations are present */
      /* check only one value for pid */
      var uniqFields = ['pid'];
      linenb++;
      fields = Object.keys(record);
      record['error'] = '';
      //console.log(fields);
      fields.forEach(function (field) {
        var occurence = record[field]; // to count occurence of every field
        //console.log(util.inspect(occurence));
        if (columns[field]) {
          if (columns[field][occurence]) {
            columns[field][occurence]++;
            if (uniqFields.indexOf(field) !== -1) {
              record['error'] += "Warning : Field "
                + field + " appair more than once = " + occurence + " ";
              errorRecords.push(record);
              errorFields = errorFields.uniqueMerge(record.keys);
              ridsyntaxerrors++;
            }
          } else {
            columns[field][occurence] = 1;
          }
        } else {
          columns[field] = {};
          columns[field][occurence] = 1;
        }

        /* check minimum vital informations are present */
        if (field === 'pid') {
          rid = true;
        } else if (field.match(/issn/)) {
          /* check each issn or eissn is valid */
          rid = true;
          if (!ridchecker.checkISSN(occurence)) {
            record['error'] += "Warning : Field " + field + " is not valid = " + occurence
              + " (controled value is " + ridchecker.getISSN(occurence) + ") ";
            errorRecords.push(record);
            errorFields = errorFields.uniqueMerge(Object.keys(record));
            ridsyntaxerrors++;
          }
        } else if (field.match(/isbn/)) {
          /* check each isbn or eisbn is valid */
          rid = true;
          ridchecker.checkISBN(occurence);
        } else if (field === 'doi') {
          rid = true;
          if (!ridchecker.checkDOI(occurence)) {
            record['error'] += "Warning : Field " + field + " is not a valid DOI = " + occurence
              + ", check the syntax ";
            errorRecords.push(record);
            errorFields = errorFields.uniqueMerge(Object.keys(record));
            ridsyntaxerrors++;
          }
        }
      });
      if (!rid) {
        record['error'] += "Error : record has no identifier ";
        errorRecords.push(record);
        errorFields = errorFields.uniqueMerge(Object.keys(record));
        ridsyntaxerrors++;
      }
    });
    if (!argv.silent) {
      if (errorRecords.length) {
        if (argv.csv) {
          process.stdout.write(errorFields.join(";"));
          process.stdout.write(";\n");
          errorRecords.forEach(function (record) {
            errorFields.forEach(function (field) {
              if (/;/.test(record[field])) {
                process.stdout.write('"' + record[field].replace('"', '""') + '"');
              } else {
                process.stdout.write(record[field]);
              }
              process.stdout.write(";");
            })
            process.stdout.write("\n");
          })
        } else {
          console.log(util.inspect(errorRecords));
        }
      }
    }
    if (argv.verbose) {
      console.log("PKB : %s lignes - %s errors", linenb, ridsyntaxerrors);
      fields = Object.keys(columns);
      // todo : sort by value desc
      fields.forEach(function (field) {
        var arr = []; // for sorting purpose, desc by default
        if (argv.sort == 'asc') { arr = sortObject(columns[field]); }
        else { arr = sortObjectR(columns[field]); }
        console.log(field + "\t\t (" + arr.length + ")");
      });
    }
    process.exit(ridsyntaxerrors);
  },
  {
    silent: true
  });
}