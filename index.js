var http = require('http'),
    request = require('request'),
    when = require('when'),
    mimeMagic = require('node-ee-mime-magic');

var isTest = function() {
    return process.env.NODE_ENV === 'test';
};

var log = function() {
    if(!isTest()) {
        console.log.apply(console, arguments)
    }
};

var imageCache = {};

var imageRequest = function(options) {

    options = options || {};

    var host = options.host || 'http://lorempixel.com',
        uri = host,
        deferred = when.defer();

    if(options.path) {
        uri += options.path;
    } else {
        if(options.width) {
            uri += '/' + options.width;
        } 
        if(options.height) {
            uri += '/' + options.height;
        }
    }

    request({
        uri: uri,
        encoding: 'binary'
    }, function(error, response, body) {

        if(error || response.statusCode !== 200) {
            deferred.reject(error);
        } else {

            var imageBuffer = new Buffer(body, 'binary');

            mimeMagic(imageBuffer, function(error, result) {

                if(error) {
                    deferred.reject(error);
                } else if(!result) {
                    deferred.reject("not an image");
                } else {
                    deferred.resolve({
                        mimeType: result.mime,
                        buffer: imageBuffer
                    });
                }
            });
        }
    });

    return deferred.promise;
};

var asMiddleware = function(req, res, next) {

    var path = req.url.replace('/image', '');

    log('[dyson-lorempixel] Resolving response for', req.url, imageCache[path] ? '(cached)' : '');

    if(!imageCache[path]) {
        imageCache[path] = imageRequest({path: path});
    }

    imageCache[path].then(function(image) {
        res.setHeader('Content-Type', image.mimeType);
        res.write(image.buffer);
        res.send();
    });
};

module.exports = {
    request: imageRequest,
    asMiddleware: asMiddleware
};
