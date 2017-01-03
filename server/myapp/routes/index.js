var express = require('express');
var path = require('path');
var fs = require('fs');

var router = express.Router();
var app = express();

app.use('/static', express.static(path.join(__dirname, 'public')));

router.post('/', function(req, res, next) {
  var db = req.db;
  var json = req.body;

  var db_users = db.get('users');
  var db_contacts = db.get('contacts');
  var db_images = db.get('images');
  var db_albums = db.get('albums');
  var db_stats = db.get('statistics');
  
  var message = '';
  console.log(json);
  
  if (isEmptyObject(json)) {
    res.json({result:'failed', description:'json body is empty'});
    return;
  }
  if (!json.type) {
    res.json({result:'failed', description:'you must specify type'});
    return;
  }
  switch (json.type) {
    case "NEW_USER":
      if (!json.name || !json.email) {
        res.json({result:'failed', description:'name and email must be provided'});
        return;
      }
      db_users.insert({name:json.name, email:json.email}, function(e, new_user) {
        if (e) return next(e);
        res.json({result:'success', user_id:new_user._id, name:new_user.name, email:new_user.email});
        return;
      });
      break;

    case "GET_CONTACTS":
      if (!json.user_id) {
        res.json({result:'failed', description:'user_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id)) {
        res.json({result:'failed', description:'invalid user_id format'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];

        db_contacts.find({user_id:user._id.toString()}, {}, function(e, contacts) {
          if (e) return next(e);
          if (isEmptyObject(contacts)) {
            res.json({result:'failed', description:'no contact group found'});
            return;
          }
          var contact = contacts[0];
          if (isEmptyObject(contact.contacts)) {
            res.json({result:'failed', description:'contacts field is empty'});
            return;
          }
          res.json({result:'success', contacts:contact.contacts});
          return;
        });
      });
      break;

    case "ADD_CONTACTS":
      if (!json.user_id) {
        res.json({result:'failed', description:'user_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id)) {
        res.json({result:'failed', description:'invalid user_id format'});
        return;
      }
      if (!json.contacts) {
        res.json({result:'failed', description:'no contacts array found in json'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];
        db_contacts.find({user_id:user._id.toString()}, {}, function(e, contacts) {
          if (e) return next(e);
          if (isEmptyObject(contacts)) {
            db_contacts.insert({user_id:user._id.toString(), name:user.name, email:user.email, contacts: json.contacts}, function(e, new_contact) {
                if (e) return next(e);
                var num = new_contact.contacts.length;
                res.json({result:'success', description:'new contact group created', contacts_num:num});
                return;
            });
          } else {
            var contact = contacts[0];
            db_contacts.update({user_id:user._id.toString()},
              {user_id:contact.user_id,
               name:contact.name,
               email:contact.email,
               contacts:contact.contacts.concat(json.contacts).sort(function(a, b) {
                  var textA = a.name.toUpperCase();
                  var textB = b.name.toUpperCase();
                  return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
               })
             },
              function(e, updated_contact) {
                if (e) return next(e);
                db_contacts.find({user_id:user._id.toString()}, {}, function(e, contacts) {
                  var contact = contacts[0];
                  var num = contact.contacts.length;
                  res.json({result:'success', description:'added contacts', contacts_num:num});
                  return;
                });
            });
          }
        });
      });
      break;

    case "UPLOAD_IMG":
      if (!json.user_id) {
        res.json({result:'failed', description:'user_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id)) {
        res.json({result:'failed', description:'invalid user_id format'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];
        if (!json.img) {
          res.json({result:'failed', description:'image not included'});
          return;
        }
        var base64Data = json.img;
        var imageBuffer = decodeBase64Image(base64Data);
        var filetype = getImageContainer(base64Data);
        var filename = 'image_' + Date.now() + '.' + filetype;
        var filepath = __dirname + '/../public/images/' + filename
        fs.writeFile(filepath, imageBuffer.data, function(e, file){
          if (e) return next(e);
          var url = 'http://52.78.200.87:3000/static/images/' + filename;
          db_images.insert({user_id:user._id.toString(), img_path:filepath, img_url:url}, function(e, image) {
            if (e) return next(e);
            res.json({result:'success', img_id:image._id});
            return;
          });
        });            
      });
      break;

    case "GET_IMG":
      if (!json.user_id || !json.img_id) {
        res.json({result:'failed', description:'user_id and img_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id)) {
        res.json({result:'failed', description:'invalid user_id format'});
        return;
      }
      if (!isValidId(json.img_id)) {
        res.json({result:'failed', description:'invalid img_id format'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];
        db_images.find({user_id:user._id.toString(), _id:json.img_id}, {}, function(e, images) {
          if (e) return next(e);
          if (isEmptyObject(images)) {
            res.json({result:'failed', description:'image not found'});
            return;
          }
          var image = images[0];
          res.json({result:'success', img_url:image.img_url});
          return;
        });
      }); 
      break;

    case "DELETE_IMG":
      if (!json.user_id || !json.img_id) {
        res.json({result:'failed', description:'user_id and img_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id)) {
        res.json({result:'failed', description:'invalid user_id format'});
        return;
      }
      if (!isValidId(json.img_id)) {
        res.json({result:'failed', description:'invalid img_id format'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];
        db_images.find({user_id:user._id.toString(), _id:json.img_id}, {}, function(e, images) {
          if (e) return next(e);
          if (isEmptyObject(images)) {
            res.json({result:'failed', description:'image not found'});
            return;
          }
          var image = images[0];
          var deleted_img_id = image._id
          fs.unlink(image.img_path, function(e, result) {
            if (e) return next(e);
            db_images.deleteOne({user_id:json.user_id, _id:json.img_id}, function(e, result) {
              if (e) return next(e);

              // DELETE IMG FROM ALBUM
              db_albums.find({user_id:user._id.toString()}, {}, function (e, albums) {
                if (e) return next(e);
                if (!isEmptyObject(albums)) {
                  for (var i in albums) {
                    for (var j in albums.img_id_list) {
                      if (albums[i].img_id_list[j] == deleted_img_id) {
                        albums[i].img_id_list.splice(j, 1);
                      }
                    }
                  }
                }
              });

              res.json({result:'success', description:'deleted an image'});
              return;
            });
          });
        });
      });
      break;

    case "CREATE_ALBUM":
      if (!json.user_id) {
        res.json({result:'failed', description:'user_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id)) {
        res.json({result:'failed', description:'invalid user_id format'});
        return;
      }
      if (!json.album_name) {
        res.json({result:'failed', description:'album_name must be provided'});
        return;
      }
      if (!json.activity) {
        res.json({result:'failed', description:'activity must be provided'});
        return;
      }
      if (!json.activity.work    || (json.activity.work != '0'   && json.activity.work != '1')
        || !json.activity.study  || (json.activity.study != '0'  && json.activity.study != '1')
        || !json.activity.food   || (json.activity.food != '0'   && json.activity.food != '1')
        || !json.activity.cafe   || (json.activity.cafe != '0'   && json.activity.cafe != '1')
        || !json.activity.sports || (json.activity.sports != '0' && json.activity.sports != '1')
        || !json.activity.movie || (json.activity.movie != '0' && json.activity.movie != '1')
        || !json.activity.game   || (json.activity.game != '0'   && json.activity.game != '1')
        || !json.activity.travel || (json.activity.travel != '0' && json.activity.travel != '1')) {
        res.json({result:'failed', description:'activity list is incomplete'});
        return;
      }
      if (!json.friend_id_list) {
        res.json({result:'failed', description:'friend_id_list must be provided'});
        return;
      }
      if (!json.img_id_list) {
        res.json({result:'failed', description:'img_id_list must be provided'});
        return;
      }
      if (isEmptyObject(json.friend_id_list)) {
        res.json({result:'failed', description:'friend_id_list is empty'});
        return;
      }
      if (isEmptyObject(json.img_id_list)) {
        res.json({result:'failed', description:'img_id_list is empty'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];

        // CHECK friend ids
        db_contacts.find({user_id:user._id.toString()}, {}, function(e, contacts) {
          if (e) return next(e);
          if (isEmptyObject(contacts)) {
            res.json({result:'failed', description:'no contact group found'});
            return;
          }
          var contacts = contacts[0].contacts;

          var num_friends = json.friend_id_list.length;
          var num_friends_match = 0;
          var friends = [];
          for (var i in json.friend_id_list) {
            for (var j in contacts) {
              if (json.friend_id_list[i] == contacts[j].friend_id) {
                num_friends_match++;
                var contact_obj = contacts[j];
                contact_obj.count = "1";
                friends = friends.concat(contact_obj);
              }
            }
          }

          var num_friends_unknown = num_friends - num_friends_match;
          if (num_friends_unknown != 0) {
            res.json({result:'failed', description:num_friends_unknown + ' friend_ids are unknown'});
            return;
          }

          // CHECK img ids
          db_images.find({user_id:user._id.toString()}, {}, function(e, images) {
            if (e) return next(e);
            if (isEmptyObject(images)) {
              res.json({result:'failed', description:'image not found'});
              return;
            }
            var num_imgs = json.img_id_list.length;
            var num_imgs_match = 0;
            for (var i in json.img_id_list) {
              for (var j in images) {
                if (json.img_id_list[i] == images[j]._id)
                  num_imgs_match++;
              }
            }

            var num_imgs_unknown = num_imgs - num_imgs_match;
            if (num_imgs_unknown != 0) {
              res.json({result:'failed', description:num_imgs_unknown + ' img_ids are unknown'});
              return;
            }

            // INSERT to albums
            db_albums.insert({user_id:user._id.toString(), album_name:json.album_name, date:json.date, activity:json.activity, friend_id_list:json.friend_id_list, img_id_list:json.img_id_list}, function (e, new_album) {
              if (e) return next(e);
              // UPDATE statistics
              db_stats.find({user_id:user._id.toString()}, {}, function(e, stats) {
                if (e) return next(e);
                if (isEmptyObject(stats)) {
                  // CREATE new stats
                  var init_activity = {
                    "work": "0",
                    "study": "0",
                    "food": "0",
                    "cafe": "0",
                    "sports": "0",
                    "movie": "0",
                    "game": "0",
                    "travel": "0"
                  };
                  var init_friends = [];

                  db_stats.insert({user_id:user._id.toString(), activity:init_activity, friends:init_friends}, function(e, new_stat) {
                      if (e) return next(e);

                      // UPDATE activity values
                      new_stat.activity.work = (Number(new_stat.activity.work) + Number(json.activity.work)).toString();
                      new_stat.activity.study = (Number(new_stat.activity.study) + Number(json.activity.study)).toString();
                      new_stat.activity.food = (Number(new_stat.activity.food) + Number(json.activity.food)).toString();
                      new_stat.activity.cafe = (Number(new_stat.activity.cafe) + Number(json.activity.cafe)).toString();
                      new_stat.activity.sports = (Number(new_stat.activity.sports) + Number(json.activity.sports)).toString();
                      new_stat.activity.movie = (Number(new_stat.activity.movie) + Number(json.activity.movie)).toString();
                      new_stat.activity.game = (Number(new_stat.activity.game) + Number(json.activity.game)).toString();
                      new_stat.activity.travel = (Number(new_stat.activity.travel) + Number(json.activity.travel)).toString();

                      db_stats.update({user_id:user._id.toString()},
                        {user_id:user._id.toString(),
                          activity:new_stat.activity,
                          friends:friends},
                        function (e, updated_stat) {
                          if (e) return next(e);
                          res.json({result:'success', description:'created new album and new stats', album_id:new_album._id});
                          return;
                        });
                  });
                } else {
                  // UPDATE stats
                  var stat = stats[0];

                  // UPDATE activity values
                  stat.activity.work = (Number(stat.activity.work) + Number(json.activity.work)).toString();
                  stat.activity.study = (Number(stat.activity.study) + Number(json.activity.study)).toString();
                  stat.activity.food = (Number(stat.activity.food) + Number(json.activity.food)).toString();
                  stat.activity.cafe = (Number(stat.activity.cafe) + Number(json.activity.cafe)).toString();
                  stat.activity.sports = (Number(stat.activity.sports) + Number(json.activity.sports)).toString();
                  stat.activity.movie = (Number(stat.activity.movie) + Number(json.activity.movie)).toString();
                  stat.activity.game = (Number(stat.activity.game) + Number(json.activity.game)).toString();
                  stat.activity.travel = (Number(stat.activity.travel) + Number(json.activity.travel)).toString()

                  // UPDATE friends count
                  var new_friends = []
                  for (var i in friends) {
                    var flag_find = false;
                    for (var j in stat.friends) {
                      if (friends[i].friend_id == stat.friends[j].friend_id) {
                        flag_find = true;
                        stat.friends[j].count = (Number(stat.friends[j].count) + Number(friends[i].count)).toString();
                      }
                    }
                    if (!flag_find)
                      new_friends = new_friends.concat(friends[i]);
                  }

                  db_stats.update({user_id:user._id.toString()},
                    {user_id:user._id.toString(),
                      activity:stat.activity,
                      friends:stat.friends.concat(new_friends)},
                    function (e, updated_stat) {
                      if (e) return next(e);
                      res.json({result:'success', description:'created new album and updated stats', album_id:new_album._id});
                      return;
                    });
                }
              });
            });
          });
        });
      });
      break;

    case "GET_ALBUM_LIST":
      if (!json.user_id) {
        res.json({result:'failed', description:'user_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id)) {
        res.json({result:'failed', description:'invalid user_id format'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];

        db_albums.find({user_id:user._id.toString()}, {}, function(e, albums) {
          if (e) return next(e);
          if (isEmptyObject(albums)) {
            res.json({result:'failed', description:'no album found'});
            return;
          }
          var album_id_list = [];
          for (var i in albums) {
            album_id_list = album_id_list.concat(albums[i]._id.toString());
          }
          res.json({result:'success', album_id_list:album_id_list});
          return;
        });
      });
      break;

    case "GET_ALBUM":
      if (!json.user_id || !json.album_id) {
        res.json({result:'failed', description:'user_id and album_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id)) {
        res.json({result:'failed', description:'invalid user_id format'});
        return;
      }
      if (!isValidId(json.album_id)) {
        res.json({result:'failed', description:'invalid album_id format'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];
        db_albums.find({_id:json.album_id, user_id:user._id.toString()}, {}, function(e, albums) {
          if (e) return next(e);
          if (isEmptyObject(albums)) {
            res.json({result:'failed', description:'album not found'});
            return;
          }
          var album = albums[0];

          // translate friend list
          db_contacts.find({user_id:user._id.toString()}, {}, function(e, contacts) {
            if (e) return next(e);
            if (isEmptyObject(contacts)) {
              res.json({result:'failed', description:'no contact group found'});
              return;
            }
            var contacts = contacts[0].contacts;

            var num_friends = album.friend_id_list.length;
            var num_friends_match = 0;
            var friend_list = [];
            for (var i in album.friend_id_list) {
              for (var j in contacts) {
                if (album.friend_id_list[i] == contacts[j].friend_id) {
                  num_friends_match++;
                  friend_list = friend_list.concat(contacts[j]);
                }
              }
            }

            var num_friends_unknown = num_friends - num_friends_match;
            if (num_friends_unknown != 0) {
              res.json({result:'failed', description:num_friends_unknown + ' friend_ids are unknown'});
              return;
            }

            // translate img list
            db_images.find({user_id:user._id.toString()}, {}, function(e, images) {
              if (e) return next(e);
              if (isEmptyObject(images)) {
                res.json({result:'failed', description:'image not found'});
                return;
              }
              var num_imgs = album.img_id_list.length;
              var num_imgs_match = 0;
              var img_url_list = [];
              for (var i in album.img_id_list) {
                for (var j in images) {
                  if (album.img_id_list[i] == images[j]._id) {
                    num_imgs_match++;
                    img_url_list = img_url_list.concat(images[j].img_url);
                  }
                }
              }

              var num_imgs_unknown = num_imgs - num_imgs_match;
              if (num_imgs_unknown != 0) {
                res.json({result:'failed', description:num_imgs_unknown + ' img_ids are unknown'});
                return;
              }

              res.json({result:'success', album_name:album.album_name, date:album.date, activity:album.activity, friend_list:friend_list, img_url_list:img_url_list});
              return;              
            });
          });
        });
      }); 
      break;

    case "UPDATE_ALBUM":
      if (!json.user_id || !json.album_id) {
        res.json({result:'failed', description:'user_id and ambum_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id) || !isValidId(json.album_id)) {
        res.json({result:'failed', description:'invalid user_id or album_id format'});
        return;
      }
      if (!json.activity) {
        res.json({result:'failed', description:'activity must be provided'});
        return;
      }
      if (!json.activity.work    || (json.activity.work != '0'   && json.activity.work != '1')
        || !json.activity.study  || (json.activity.study != '0'  && json.activity.study != '1')
        || !json.activity.food   || (json.activity.food != '0'   && json.activity.food != '1')
        || !json.activity.cafe   || (json.activity.cafe != '0'   && json.activity.cafe != '1')
        || !json.activity.sports || (json.activity.sports != '0' && json.activity.sports != '1')
        || !json.activity.movie  || (json.activity.movie != '0' && json.activity.movie != '1')
        || !json.activity.game   || (json.activity.game != '0'   && json.activity.game != '1')
        || !json.activity.travel || (json.activity.travel != '0' && json.activity.travel != '1')) {
        res.json({result:'failed', description:'activity list is incomplete'});
        return;
      }
      if (!json.friend_id_list) {
        res.json({result:'failed', description:'friend_id_list must be provided'});
        return;
      }
      if (!json.img_id_list) {
        res.json({result:'failed', description:'img_id_list must be provided'});
        return;
      }
      if (isEmptyObject(json.friend_id_list)) {
        res.json({result:'failed', description:'friend_id_list is empty'});
        return;
      }
      if (isEmptyObject(json.img_id_list)) {
        res.json({result:'failed', description:'img_id_list is empty'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];

        // CHECK friend ids
        db_contacts.find({user_id:user._id.toString()}, {}, function(e, contacts) {
          if (e) return next(e);
          if (isEmptyObject(contacts)) {
            res.json({result:'failed', description:'no contact group found'});
            return;
          }
          var contacts = contacts[0].contacts;

          var num_friends = json.friend_id_list.length;
          var num_friends_match = 0;
          var friends = [];
          for (var i in json.friend_id_list) {
            for (var j in contacts) {
              if (json.friend_id_list[i] == contacts[j].friend_id) {
                num_friends_match++;
                var contact_obj = contacts[j];
                contact_obj.count = "1";
                friends = friends.concat(contact_obj);
              }
            }
          }

          var num_friends_unknown = num_friends - num_friends_match;
          if (num_friends_unknown != 0) {
            res.json({result:'failed', description:num_friends_unknown + ' friend_ids are unknown'});
            return;
          }

          // CHECK img ids
          db_images.find({user_id:user._id.toString()}, {}, function(e, images) {
            if (e) return next(e);
            if (isEmptyObject(images)) {
              res.json({result:'failed', description:'image not found'});
              return;
            }
            var num_imgs = json.img_id_list.length;
            var num_imgs_match = 0;
            for (var i in json.img_id_list) {
              for (var j in images) {
                if (json.img_id_list[i] == images[j]._id)
                  num_imgs_match++;
              }
            }

            var num_imgs_unknown = num_imgs - num_imgs_match;
            if (num_imgs_unknown != 0) {
              res.json({result:'failed', description:num_imgs_unknown + ' img_ids are unknown'});
              return;
            }

            // INSERT to albums
            db_albums.find({_id:json.album_id, user_id:user._id.toString()}, {}, function(e, albums) {
              if (e) return next(e);
              if (isEmptyObject(albums)) {
                res.json({result:'failed', description:'album not found'});
                return;
              }
              var album = albums[0];
              var delta_work = (Number(json.activity.work) - Number(album.activity.work)).toString();
              var delta_study = (Number(json.activity.study) - Number(album.activity.study)).toString();
              var delta_food = (Number(json.activity.food) - Number(album.activity.food)).toString();
              var delta_cafe = (Number(json.activity.cafe) - Number(album.activity.cafe)).toString();
              var delta_sports = (Number(json.activity.sports) - Number(album.activity.sports)).toString();
              var delta_movie = (Number(json.activity.movie) - Number(album.activity.movie)).toString();
              var delta_game = (Number(json.activity.game) - Number(album.activity.game)).toString();
              var delta_travel = (Number(json.activity.travel) - Number(album.activity.travel)).toString();

              for (var i in friends) {
                var flag_find = false;
                for (var j in album.friend_id_list) {
                  if (friends[i].friend_id == album.friend_id_list[j]) {
                    flag_find = true;
                    friends[i].count = "0";
                  }
                }
                if (!flag_find)
                  friends[i].count = "1";
              }

              db_albums.update({_id:json.album_id},
                {
                  user_id:album.user_id,
                  album_name:album.album_name,
                  activity:json.activity,
                  friend_id_list:json.friend_id_list,
                  img_id_list:json.img_id_list},
                function (e, updated_album) {
                  if (e) return next(e);
                  // update statistics db
                  db_stats.find({user_id:user._id.toString()}, {}, function(e, stats) {
                    if (e) return next(e);
                    if (isEmptyObject(stats)) {
                      res.json({result:'failed', description:'stats not found'})
                      return;
                    }
                    var stat = stats[0];

                    // UPDATE activity values
                    stat.activity.work = (Number(stat.activity.work) + Number(delta_work)).toString();
                    stat.activity.study = (Number(stat.activity.study) + Number(delta_study)).toString();
                    stat.activity.food = (Number(stat.activity.food) + Number(delta_food)).toString();
                    stat.activity.cafe = (Number(stat.activity.cafe) + Number(delta_cafe)).toString();
                    stat.activity.sports = (Number(stat.activity.sports) + Number(delta_sports)).toString();
                    stat.activity.movie = (Number(stat.activity.movie) + Number(delta_movie)).toString();
                    stat.activity.game = (Number(stat.activity.game) + Number(delta_game)).toString();
                    stat.activity.travel = (Number(stat.activity.travel) + Number(delta_travel)).toString();

                    // UPDATE friends count
                    for (var i in friends) {
                      for (var j in stat.friends) {
                        if (friends[i].friend_id == stat.friends[j].friend_id) {
                          stat.friends[j].count = (Number(stat.friends[j].count) + Number(friends[i].count)).toString();
                        }
                      }
                    }

                    for (var i in stat.friends) {
                      var flag_find = false;
                      for (var j in friends) {
                        if (stat.friends[i].friend_id == friends[j].friend_id) {
                          flag_find = true;
                        }
                      }
                      if (!flag_find) {
                        stat.friends.splice(i, 1);
                      }
                    }

                    db_stats.update({user_id:user._id.toString()},
                      {user_id:stat.user_id,
                        activity:stat.activity,
                        friends:stat.friends},
                      function(e, updated_stat) {
                        if (e) return next(e);
                        res.json({result:'success', description:'updated album and stats', album_id:album.user_id});
                        return;
                    });
                  });
              });
            });
          });
        });
      });
      break;

    case "DELETE_ALBUM":
      if (!json.user_id || !json.album_id) {
        res.json({result:'failed', description:'user_id and album_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id)) {
        res.json({result:'failed', description:'invalid user_id format'});
        return;
      }
      if (!isValidId(json.album_id)) {
        res.json({result:'failed', description:'invalid album_id format'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];
        db_albums.find({user_id:user._id.toString(), _id:json.album_id}, {}, function(e, albums) {
          if (e) return next(e);
          if (isEmptyObject(albums)) {
            res.json({result:'failed', description:'albums not found'});
            return;
          }
          var album = albums[0];

          var dec_work = album.activity.work;
          var dec_study = album.activity.study;
          var dec_food = album.activity.food;
          var dec_cafe = album.activity.cafe;
          var dec_sports = album.activity.sports;
          var dec_movie = album.activity.movie;
          var dec_game = album.activity.game;
          var dec_travel = album.activity.travel;
          var dec_friend_id_list = album.friend_id_list;

          db_albums.remove({user_id:user._id.toString(), _id:json.album_id}, function(e, result) {
            if (e) return next(e);
            // UPDATE stats
            db_stats.find({user_id:user._id.toString()}, {}, function(e, stats) {
              if (e) return next(e);
              if (isEmptyObject(stats)) {
                res.json({result:'failed', description:'stats not found'})
                return;
              }
              var stat = stats[0];

              // UPDATE activity values
              stat.activity.work = (Number(stat.activity.work) - Number(dec_work)).toString();
              stat.activity.study = (Number(stat.activity.study) - Number(dec_study)).toString();
              stat.activity.food = (Number(stat.activity.food) - Number(dec_food)).toString();
              stat.activity.cafe = (Number(stat.activity.cafe) - Number(dec_cafe)).toString();
              stat.activity.sports = (Number(stat.activity.sports) - Number(dec_sports)).toString();
              stat.activity.movie = (Number(stat.activity.movie) - Number(dec_movie)).toString();
              stat.activity.game = (Number(stat.activity.game) - Number(dec_game)).toString();
              stat.activity.travel = (Number(stat.activity.travel) - Number(dec_travel)).toString();

              // UPDATE friends count
              for (var i in dec_friend_id_list) {
                for (var j in stat.friends) {
                  if (dec_friend_id_list[i] == stat.friends[j].friend_id) {
                    stat.friends[j].count = (Number(stat.friends[j].count) - 1).toString();
                    if (Number(stat.friends[j].count) == 0) {
                      stat.friends.splice(j, 1);
                    }
                  }
                }
              }
              db_stats.update({user_id:user._id.toString()},
                {user_id:stat.user_id,
                  activity:stat.activity,
                  friends:stat.friends},
                function(e, updated_stat) {
                  if (e) return next(e);
                  res.json({result:'success', description:'deleted an album'});
                  return;
              });
            });
          });
        });
      });
      break;

    case "GET_STATS":
      if (!json.user_id) {
        res.json({result:'failed', description:'user_id must be provided'});
        return;
      }
      if (!isValidId(json.user_id)) {
        res.json({result:'failed', description:'invalid user_id format'});
        return;
      }
      db_users.find({_id:json.user_id}, {}, function(e, users) {
        if (e) return next(e);
        if (isEmptyObject(users)) {
          res.json({result:'failed', description:'user not registered'});
          return;
        }
        var user = users[0];
        db_stats.find({user_id:user._id.toString()}, {}, function(e, stats) {
          if (e) return next(e);
          if (isEmptyObject(stats)) {
            res.json({result:'failed', description:'stats not found'});
            return;
          }
          var stat = stats[0];
          res.json({result:'success', activity:stat.activity, friends:stat.friends});
          return;
        });
      });
      break;

    default:
      res.json({result:'failed', description:'unknown type'});
      break;
  }
});

function isEmptyObject(obj) {
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false;
    }
  }
  return true;
}

function isValidId(obj) {
  if (isEmptyObject(obj))
    return false;
  var id = obj;
  if (typeof id == "string") {
    var length = id.replace(/[\0-\x7f]|([0-\u07ff]|(.))/g,"$&$1$2").length;
    if (length == 24)
      return true;
  }
  return false;
}

function decodeBase64Image(dataString) {
  var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),response = {};

  if (matches.length !== 3) {
    return new Error('Invalid input string');
  }

  response.type = matches[1];
  response.data = new Buffer(matches[2], 'base64');

  return response;
}

function getImageContainer(dataString) {
  var header = dataString.substring(0,30);
  var end = header.indexOf(";base64,");
  var start = "data:image/".length;
  return header.substring(start, end);
}

module.exports = router;
