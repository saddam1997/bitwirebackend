/**
 * JPYDController
 *
 * @description :: Server-side logic for managing JPYDS
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var BigNumber = require('bignumber.js');

var bitcoinJPYD = require('bitcoin');
var clientJPYD = new bitcoinJPYD.Client({
  host: sails.config.company.clientJPYDhost,
  port: sails.config.company.clientJPYDport,
  user: sails.config.company.clientJPYDuser,
  pass: sails.config.company.clientJPYDpass
});

module.exports = {
  getNewJPYDAddress: function(req, res) {
    var userMailId = req.body.userMailId;
    if (!userMailId) {
      return res.json({
        "message": "Can't be empty!!!",
        statusCode: 400
      });
    }
    User.findOne({
      email: userMailId
    }).exec(function(err, user) {
      if (err) {
        return res.json({
          "message": "Error to find user",
          statusCode: 401
        });
      }
      if (!user) {
        return res.json({
          "message": "Invalid email!",
          statusCode: 401
        });
      }
      clientJPYD.cmd('getnewaddress', userMailId, function(err, address) {
        if (err)
          return res.json({
            "message": "Failed to get new address from JPYD server",
            statusCode: 400
          });

        console.log('JPYD address generated', address);

        if (!user.isJPYDAddress) {
          User.update({
            email: userMailId
          }, {
            isJPYDAddress: true
          }).exec(function afterwards(err, updated) {
            if (err) {
              return res.json({
                "message": "Failed to update new address in database",
                statusCode: 401
              });
            }
            // return res.json({
            //   newaddress: address,
            //   statusCode: 200
            // });
          });
        }
        return res.json({
          newaddress: address,
          statusCode: 401
        });
      });
    });
  },
  getJPYDAddressByAccount: function(req, res) {
    var userMailId = req.body.userMailId;
    if (!userMailId)
      return res.json({
        "message": "Can't be empty!!!",
        statusCode: 400
      });
    User.findOne({
      email: userMailId
    }).populateAll().exec(function(err, user) {
      if (err) {
        return res.json({
          "message": "Error to find user",
          statusCode: 401
        });
      }
      if (!user) {
        return res.json({
          "message": "Invalid email!",
          statusCode: 401
        });
      }
      clientJPYD.cmd('getaddressesbyaccount', userMailId, function(err, listaddress) {
        if (err) {
          return res.json({
            "message": "Failed to get new address from JPYD server",
            statusCode: 400
          });
        }
        console.log('JPYD address generated', listaddress);
        return res.json({
          listaddress: listaddress,
          statusCode: 200
        });
      });
    });
  },
  sendJPYD: function(req, res, next) {
    console.log("Enter into sendJPYD");
    var userEmailAddress = req.body.userMailId;
    var userJPYDAmountToSend = parseFloat(req.body.amount);
    var userReceiverJPYDAddress = req.body.recieverJPYDCoinAddress;
    var userSpendingPassword = req.body.spendingPassword;
    var miniJPYDAmountSentByUser = 0.001;
    miniJPYDAmountSentByUser = parseFloat(miniJPYDAmountSentByUser);
    if (!userEmailAddress || !userJPYDAmountToSend || !userReceiverJPYDAddress ||
      !userSpendingPassword) {
      console.log("Can't be empty!!! by user ");
      return res.json({
        "message": "Can't be empty!!!",
        statusCode: 400
      });
    }
    if (userJPYDAmountToSend < miniJPYDAmountSentByUser) {
      console.log("Sending amount is not less then " + miniJPYDAmountSentByUser);
      return res.json({
        "message": "Sending amount JPYD is not less then " + miniJPYDAmountSentByUser,
        statusCode: 400
      });
    }
    User.findOne({
      email: userEmailAddress
    }).exec(function(err, userDetails) {
      if (err) {
        return res.json({
          "message": "Error to find user",
          statusCode: 401
        });
      }
      if (!userDetails) {
        return res.json({
          "message": "Invalid email!",
          statusCode: 401
        });
      } else {
        console.log(JSON.stringify(userDetails));
        User.compareSpendingpassword(userSpendingPassword, userDetails,
          function(err, valid) {
            if (err) {
              console.log("Eror To compare password !!!");
              return res.json({
                "message": err,
                statusCode: 401
              });
            }
            if (!valid) {
              console.log("Invalid spendingpassword !!!");
              return res.json({
                "message": 'Enter valid spending password',
                statusCode: 401
              });
            } else {
              console.log("Valid spending password !!!");
              console.log("Spending password is valid!!!");
              var minimumNumberOfConfirmation = 1;
              //var netamountToSend = (parseFloat(userJPYDAmountToSend) - parseFloat(sails.config.company.txFeeJPYD));
              var transactionFeeOfJPYD = new BigNumber(sails.config.company.txFeeJPYD);
              var netamountToSend = new BigNumber(userJPYDAmountToSend);
              netamountToSend = netamountToSend.minus(transactionFeeOfJPYD);

              console.log("clientJPYD netamountToSend :: " + netamountToSend);
              clientJPYD.cmd('sendfrom', userEmailAddress, userReceiverJPYDAddress, parseFloat(netamountToSend),
                minimumNumberOfConfirmation, userReceiverJPYDAddress, userReceiverJPYDAddress,
                function(err, TransactionDetails, resHeaders) {
                  if (err) {
                    console.log("Error from sendFromJPYDAccount:: " + err);
                    if (err.code && err.code == "ECONNREFUSED") {
                      return res.json({
                        "message": "JPYD Server Refuse to connect App",
                        statusCode: 400
                      });
                    }
                    if (err.code && err.code == -5) {
                      return res.json({
                        "message": "Invalid JPYD Address",
                        statusCode: 400
                      });
                    }
                    if (err.code && err.code == -6) {
                      return res.json({
                        "message": "Account has Insufficient funds",
                        statusCode: 400
                      });
                    }
                    if (err.code && err.code < 0) {
                      return res.json({
                        "message": "Problem in JPYD server",
                        statusCode: 400
                      });
                    }
                    return res.json({
                      "message": "Error in JPYD Server",
                      statusCode: 400
                    });
                  }
                  console.log('TransactionDetails :', TransactionDetails);

                  clientJPYD.cmd('gettransaction', TransactionDetails,
                    function(err, txDetails, resHeaders) {
                      if (err) {
                        console.log("Error from sendFromJPYDAccount:: " + err);
                        return res.json({
                          "message": "Error in JPYD Server",
                          statusCode: 400
                        });
                      }
                      console.log('txDetails :' + txDetails);
                      var txFeeFromNode = Math.abs(txDetails.fee);
                      var amountToMoveInCompanyAccount = transactionFeeOfJPYD.minus(txFeeFromNode);
                      console.log("Move in company Account :: " + amountToMoveInCompanyAccount);
                      clientJPYD.cmd('move', userEmailAddress, sails.config.common.companyJPYDAccount, amountToMoveInCompanyAccount,
                        function(err, moveCompanyDetails, resHeaders) {
                          if (err) {
                            console.log("Error from sendFromJPYDAccount:: " + err);
                            if (err.code && err.code == "ECONNREFUSED") {
                              return res.json({
                                "message": "JPYD Server Refuse to connect App",
                                statusCode: 400
                              });
                            }
                            if (err.code && err.code == -5) {
                              return res.json({
                                "message": "Invalid JPYD Address",
                                statusCode: 400
                              });
                            }
                            if (err.code && err.code == -6) {
                              return res.json({
                                "message": "Account has Insufficient funds",
                                statusCode: 400
                              });
                            }
                            if (err.code && err.code < 0) {
                              return res.json({
                                "message": "Problem in JPYD server",
                                statusCode: 400
                              });
                            }
                            return res.json({
                              "message": "Error in JPYD Server",
                              statusCode: 400
                            });
                          }
                          console.log('moveCompanyDetails :', moveCompanyDetails);
                          return res.json({
                            txid: TransactionDetails,
                            message: "Sent Successfully",
                            statusCode: 200
                          });
                        });
                    });
                });
            }
          });
      }
    });
  },
  getTxsListJPYD: function(req, res, next) {
    console.log("Enter into getTxsListJPYD::: ");
    var userMailId = req.body.userMailId;
    if (!userMailId) {
      console.log("Can't be empty!!! by user.....");
      return res.json({
        "message": "Can't be empty!!!",
        statusCode: 400
      });
    }
    User.findOne({
      email: userMailId
    }).exec(function(err, user) {
      if (err) {
        console.log("Error to find user !!!");
        return res.json({
          "message": "Error to find user",
          statusCode: 401
        });
      }
      if (!user) {
        console.log("Invalid Email !!!");
        return res.json({
          "message": "Invalid email!",
          statusCode: 401
        });
      }
      clientJPYD.cmd(
        'listtransactions',
        userMailId,
        function(err, transactionList) {
          if (err) {
            console.log("Error from sendFromJPYDAccount:: ");
            if (err.code && err.code == "ECONNREFUSED") {
              return res.json({
                "message": "JPYD Server Refuse to connect App",
                statusCode: 400
              });
            }
            if (err.code && err.code < 0) {
              return res.json({
                "message": "Problem in JPYD server",
                statusCode: 400
              });
            }
            return res.json({
              "message": "Error in JPYD Server",
              statusCode: 400
            });
          }
          console.log("Return transactionList List !! ");
          return res.json({
            "tx": transactionList,
            statusCode: 200
          });
        });
    });
  },
  getBalJPYD: function(req, res, next) {
    console.log("Enter into getBalJPYD::: ");
    var userMailId = req.body.userMailId;
    if (!userMailId) {
      console.log("Can't be empty!!! by user.....");
      return res.json({
        "message": "Can't be empty!!!",
        statusCode: 400
      });
    }
    User.findOne({
      email: userMailId
    }).populateAll().exec(function(err, user) {
      if (err) {
        return res.json({
          "message": "Error to find user",
          statusCode: 401
        });
      }
      if (!user) {
        return res.json({
          "message": "Invalid email!",
          statusCode: 401
        });
      }
      console.log("Valid User :: " + JSON.stringify(user));
      clientJPYD.cmd(
        'getbalance',
        userMailId,
        function(err, userJPYDMainbalanceFromServer, resHeaders) {
          if (err) {
            console.log("Error from sendFromJPYDAccount:: ");
            if (err.code && err.code == "ECONNREFUSED") {
              return res.json({
                "message": "JPYD Server Refuse to connect App",
                statusCode: 400
              });
            }
            if (err.code && err.code < 0) {
              return res.json({
                "message": "Problem in JPYD server",
                statusCode: 400
              });
            }
            return res.json({
              "message": "Error in JPYD Server",
              statusCode: 400
            });
          }
          return res.json({
            balanceJPYD: userJPYDMainbalanceFromServer,
            statusCode: 200
          });
        });
    });
  },
};