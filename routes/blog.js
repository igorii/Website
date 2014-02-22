// Const variables
var WEBSITE = 'http://192.241.281.202'

var html_md = require('html-md');
var RSS     = require('rss');
var emailjs = require('emailjs');
var grav    = require('gravatar');
var routePrefix = 'blog/';

// Initialize the rss feed
var feed = new RSS({
    title: 'Tim Thornton',
    description: 'A personal blog of programming and computer sciency stuff',
    feed_url: WEBSITE + '/blog/rss/',
    site_url: WEBSITE,
    author: 'Tim Thornton',
    language: 'English'
});

// Pull in the article provider
var Provider = require('../lib/articles').provider;

// Create a new provider
var provider = new Provider('localhost', 27017);

// Intialize the RSS feed upon startup
setTimeout(function () {
    provider.findAll(function (error, docs) {
        if (error) return;
        else docs.forEach(function (article) {
            addToRss(feed, article);
        });
    });
}, 1000);

function addToRss (feed, article) {
    feed.item({
        title       : article.title,
        description : 'New blog post at ' + WEBSITE,
        url         : WEBSITE + '/blog/id/' + article._id,
        guid        : '' + article._id,
        date        : article['created-at']
    });

    return feed;
}

// Serve all articles
exports.articles = function (req, res) {
    provider.findAll(function (error, docs) {
        if (error) { 
            res.status(500).end();
        } else {
            res.send(docs);
        }
    });
};

function resolveGravatar (comment) {
    if (comment instanceof Array)
        return resolveGravatars(comment);

    comment.gravatar = grav.url(comment.email, {s: '40', r: 'pg', d: 'retro'});
    return comment;
}

function resolveGravatars (comments) {
    return comments.map(resolveGravatar);
}

exports.single = function (req, res) {
    console.log(req.params.id);
    provider.findById(req.params.id, function (error, doc) {
        if (error || doc === null) {
            res.status(500).end();
        } else {
            doc.full = true; // Flag to add comments
            doc.comments = resolveGravatar(doc.comments); 
            res.render(routePrefix + 'article', {
                article: doc,
                recent: []
            });
        }
    });
};

exports.comment = function (req, res) {

    // Update the article with the new body
    provider.comment({
        user    : req.param('name') || 'Anonymous',
        email   : req.param('email'),
        content : req.param('content'),
        notify  : req.param('notify') || 'off',
        _id     : req.param('_id')
    }, function (error, docs) {
        if (error) res.status(500).end();
        else { 

            // TODO: Email all users with the 'notify' flag set
            // TODO: Add 'reply to' mechanism to reply to comments
            //       and restrict the above emails being sent

            // Direct the user to the updated page
            res.redirect('/blog/id/' + req.param('_id'));
        }
    });
}

function notify () {}

exports.commentReply = function (req, res) {
    provider.replyTo(req.param('parent_id'), {
        user    : req.param('name') || 'Anonymous',
        email   : req.param('email'),
        content : req.param('content'),
        notify  : req.param('notify') || 'off',
        _id     : req.param('_id')
    }, function (error, article) {
        if (error) res.status(500).end();
        else {

            // Notify the parent of the reply if necessary
            if (req.param('notify') === 'on') {
                var parents = article.comments.filter(function (article) {
                    article._id === req.param('parent_id');
                });

                if (parents.length > 0) {
                    var email = parents[0].email;
                    notify(email, req.param('name'), req.param('content'));
                }
            }

            // Redirect to the article
            res.redirect('/blog/id/' + req.param('_id'));
        }
    });
};

exports.recent = function (callback) {
    provider.findAll(function (error, docs) {
        if (error) callback([]);
        else callback(docs.sort(function (a1, a2) { 
            return a1.created_at < a2.created_at;
        }).slice(0,3)); // Take the first 3
    });
};

exports.all = function (req, res) {
    provider.findAll(function (error, docs) {
        exports.recent(function (recent) {
            if (error) {
                res.status(500).end();
            } else {
                res.render(routePrefix + 'blog', {
                    articles: docs.sort(function (a1, a2) { 
                        return a1.created_at < a2.created_at;
                    }).filter(function (article) {
                        return article.body;
                    }).map(function (article) {
                        article.body = article.body.split('</p>')[0] + '</p>' + 
                                       article.body.split('</p>')[1] + '</p>';
                        return article;
                    }),
                    recent: recent
                });
            }
        });
    });
};

exports.edit = function (req, res) {
    provider.findById(req.params.id, function (error, doc) {
        if (error || doc === null) {
            res.status(500).end();
        } else {
            res.render(routePrefix + 'edit', {
                article: {
                    body       : doc.body,
                    github     : doc.github,
                    created_at : doc.created_at,
                    title      : doc.title,
                    _id        : doc._id
                },
                recent: []
            });
        }
    });
};

exports.editDraft = function (req, res) {
    provider.findDraftById(req.params.id, function (error, doc) {
        if (error || doc === null) {
            res.status(500).end();
        } else {
            res.render(routePrefix + 'edit', {
                article: {
                    body       : doc.body,
                    github     : doc.github,
                    created_at : doc.created_at,
                    title      : doc.title,
                    _id        : doc._id
                },
                recent: []
            });
        }
    });
};

exports.update = function (req, res) {

    if (req.session.user === undefined)
        return res.status(401).send('Unauthorized');

    // Update the article with the new body
    provider.update({
        title  : req.param('title'),
        body   : req.param('body'),
        github : req.param('github') || '',
        _id    : req.param('_id')
    }, function (error, docs) {
        if (error) 
            res.status(500).end();
        else 
            res.redirect('/blog/id/' + req.param('_id'));
    });
}


exports.create = function (req, res) {
    if (req.session.user === undefined)
        return res.status(401).send('Unauthorized');

    res.render(routePrefix + 'create', {recent: []});
};

exports.admin = function (req, res) {
    if (req.session.user === undefined)
        return res.status(401).send('Unauthorized');
    
    res.render(routePrefix + 'admin', {recent: []});
}

exports.author = function (req, res) {
    if (req.session.user === undefined)
        return res.status(401).send('Unauthorized');

    if (req.param('save')) 
        save(req, res);
    else if (req.param('publish'))
        publish(req, res);
    else
        res.status(401).send('Unauthorized');
};

function save (req, res) {
    if (req.session.user === undefined)
        return res.status(401).send('Unauthorized');

    // If authorized, save the article
    provider.save({
        title    : req.param('title'),
        github   : req.param('github') || '',
        markdown : req.param('markdown')
    }, function (error, docs) {
        if (error) {
            res.status(500).end();
        } else {
            // Redirect to the blog
            res.redirect('/blog/admin');
        }
    });
};

function publish (req, res) {
    if (req.session.user === undefined)
        return res.status(401).send('Unauthorized');

    // TODO: check if it exits in the drafts store
    // if so, remove it

    // If authorized, save the article
    provider.publish({
        title    : req.param('title'),
        github   : req.param('github') || '',
        created  : req.param('created') !== '' ? new Date(req.param('created')) : new Date(), 
        markdown : req.param('markdown')
    }, function (error, docs) {
        if (error) {
            res.status(500).end();
        } else {

            // Add the article to rss
            addToRss(feed, docs[0]);

            // Redirect to the blog
            res.redirect('/blog');
        }
    });
};

exports.rss = function (req, res) {
    res.send(feed.xml('  '));
};

// TODO: 
// 1) Serve article by id
// 2) Add article
// 3) Paginate articles
