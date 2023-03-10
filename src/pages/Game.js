import React from 'react';
import './Game.css';
import Board from '../components/board.js';
import King from '../pieces/king';
import Queen from '../pieces/queen';
import Rook from '../pieces/rook';
import Bishop from '../pieces/bishop';
import Knight from '../pieces/knight';
import Pawn from '../pieces/pawn';
import Goose from '../pieces/goose';
import initialiseChessBoard from '../helpers/board-initialiser.js';


export default class Game extends React.Component {
  constructor() {
    super();
    //console.log(this.props);
    
    let initialGeeseColors = ["Purple","Black","Orange","Red","Yellow","Green","Blue","Darkblue","Darkgreen"];
    //initialGeeseColors.sort(() => (Math.random() > .5) ? 1 : -1);

    this.state = {
      squares: initialiseChessBoard(),
      geese: [],
      player: 1,
      sourceSelection: -1,
      status: '',
      turn: 'white',
      enPassantColumn: -2,
      numberOfFallenSoldiers: 1,
      geeseColors: initialGeeseColors,
      connection: null,
      ingame: false,
    }
    
    // setting the intial board to include a goose
    for (let i = 0; i < 2; i++) {
      let notValidSquare = true;
      let randomValue = 0;
      while (notValidSquare) {
        randomValue = Math.floor(Math.random() * (39 - 24 + 1)) + 24;
        if (this.state.squares[randomValue] === null) {
          notValidSquare = false;
        }
      }


      initialGeeseColors.sort(() => (Math.random() > .5) ? 1 : -1)
      let color = initialGeeseColors.pop();

      let initialGoose = new Goose(3, randomValue, color);
      this.state.squares[randomValue] = initialGoose;
      console.log("Initial goose starting value: " + randomValue);
      this.state.geese.push(initialGoose);
    }
  }

  componentDidMount() {
    const connection = new WebSocket("ws://18.188.216.102:8080") 
    console.log(connection);

    this.setState({
      connection: connection,
    });

    connection.onopen = (event) => {
      console.log("connected to server")
      connection.send(JSON.stringify({
        type: "queue"
      }))
    };

    connection.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("Recieved a message from the server " + msg.type);
      switch(msg.type) {
        case "queue":
          this.setState({status: "Waiting for an opponent"})
          break;
        case "gameFound":
          // let the player know that they are now in a game
          console.log(msg.playerNum)
          this.setState({
            status: "",
            ingame: true,
            player: msg.playerNum
          })
          break;
        case "boardUpdate":
          this.deserialize(msg.data)
          // resetting the turn so that the player can move again (other players move has been recieved).
          let turnT = this.state.turn === 'white' ? 'black' : 'white';

          this.setState({
            turn: turnT
          })

          break;
        case "endGame":
          alert(this.state.turn.charAt(0).toUpperCase() + this.state.turn.slice(1) + " wins!")
          window.location.href = "/";
          break;
        case "close":
          // opposing player left the game: kick player back to lobby
          alert("The opponent left the match");
          window.location.href = "/";
          break;
        default:
          break;
      }
    }
  }

  async handleClick(i) {
    if (!this.state.ingame) {
      //waiting to find a game
      return;
    }

    if ((this.state.turn === "white" && this.state.player === 2) || (this.state.turn === "black" && this.state.player === 1)) {
      this.setState({status: "It's not your turn."})
      return;
    } 

    const squares = [...this.state.squares];

    if (this.state.sourceSelection === -1) {
      if (!squares[i] || squares[i].player !== this.state.player) {
        this.setState({ status: "Wrong selection. Choose the " + this.state.turn + " pieces" });
        if (squares[i]) {
          squares[i].style = { ...squares[i].style, backgroundColor: "" };
        }
      }
      else {
        squares[i].style = { ...squares[i].style, backgroundColor: "RGB(111,143,114)" }; // Emerald from http://omgchess.blogspot.com/2015/09/chess-board-color-schemes.html
        this.setState({
          status: "Choose destination for the selected piece",
          sourceSelection: i
        })
      }
      return
    }

    

    squares[this.state.sourceSelection].style = { ...squares[this.state.sourceSelection].style, backgroundColor: "" };

    if (squares[i] && squares[i].player === this.state.player) {
      squares[i].style = { ...squares[i].style, backgroundColor: "RGB(111,143,114)" };
      this.setState({
        sourceSelection: i,
      });
      return


    }

    if (squares[this.state.sourceSelection].constructor.name === "King" && !squares[this.state.sourceSelection].moved && (this.state.sourceSelection - i === -3 || this.state.sourceSelection - i === 4)) {
      if (i < this.state.sourceSelection) i += 2
      else i -= 1
    }

    if (squares[i] && squares[i].player === this.state.player) {
      this.setState({
        status: "Wrong selection. Choose valid source and destination again.",
        sourceSelection: -1,
      });
    }
    else {
      const isDestEnemyOccupied = Boolean(squares[i]);
      const isMovePossible = squares[this.state.sourceSelection].isMovePossible(this.state.sourceSelection, i, isDestEnemyOccupied);
      const srcToDestPath = squares[this.state.sourceSelection].getSrcToDestPath(this.state.sourceSelection, i);
      const isMoveLegal = this.isMoveLegal(srcToDestPath);
      const isCastle = squares[this.state.sourceSelection].constructor.name === "King" && Math.abs(this.state.sourceSelection - i) === 2;
      const canLeftCastle = (this.state.player === 1 && squares[56] && squares[56].constructor.name === "Rook" && !squares[56].moved && this.isMoveLegal(squares[56].getSrcToDestPath(56, 59)) && !squares[59]) ||
        (this.state.player === 2 && squares[0] && squares[0].constructor.name === "Rook" && !squares[0].moved
        && this.isMoveLegal(squares[0].getSrcToDestPath(0, 3)) && !squares[3]);
      const canRightCastle = (this.state.player === 1 && squares[63] && squares[63].constructor.name === "Rook" && !squares[63].moved && this.isMoveLegal(squares[63].getSrcToDestPath(63, 61)) && !squares[61]) ||
        (this.state.player === 2 && squares[7] && squares[7].constructor.name === "Rook" && !squares[7].moved && this.isMoveLegal(squares[7].getSrcToDestPath(7, 5)) && !squares[5]);
      const isEnPassant = squares[this.state.sourceSelection].constructor.name === "Pawn" && !squares[i] &&
        (((this.state.sourceSelection % 8) - 1 === this.state.enPassantColumn && (this.state.sourceSelection - i === 9 || this.state.sourceSelection - i === -7)) ||
        ((this.state.sourceSelection % 8) + 1 === this.state.enPassantColumn)) &&
        ((this.state.player === 1 && this.state.sourceSelection >= 24 && this.state.sourceSelection <= 31) ||
        (this.state.player === 2 && this.state.sourceSelection >= 32 && this.state.sourceSelection <= 39))
      
      if ((isMovePossible || isEnPassant) && isMoveLegal && (squares[i] === null || squares[i].constructor.name !== "Goose") && (!isCastle || (this.state.sourceSelection - i === 2 && canLeftCastle) || (this.state.sourceSelection - i === -2 && canRightCastle))) {
        if (squares[i] !== null) {
          
          await this.setState(oldState => ({numberOfFallenSoldiers: oldState.numberOfFallenSoldiers + 1}))
          //console.log("number of fallen soldiers : " + this.state.numberOfFallenSoldiers);
          if ((this.state.numberOfFallenSoldiers % 3) === 0 && this.state.numberOfFallenSoldiers !== 0 && this.state.numberOfFallenSoldiers < 24) {
            //console.log("the if statement");
            let newRandomValue = 0;
            if ((this.state.geese.length + 1) >= 4) {
              let notValidSquare = true;
              while (notValidSquare) {
                newRandomValue = Math.floor(Math.random() * (47 - 16 + 1)) + 16;
                if (this.state.squares[newRandomValue] === null) {
                  notValidSquare = false;
                }
              }
            
            } else {
              let notValidSquare = true;
              while (notValidSquare) {
                newRandomValue = Math.floor(Math.random() * (39 - 24 + 1)) + 24;
                if (this.state.squares[newRandomValue] === null) {
                  notValidSquare = false;
                }
              }
            }

            //let newColor = this.state.initialGeeseColors.pop();
            //console.log(this.state.geeseColors.length - 1);
            //let newColor = this.state.geeseColors[this.state.geeseColors.length - 1];
            let newArray = this.state.geeseColors;
            let newColor = newArray.pop();
            await this.setState(oldState => ({geeseColors: newArray}));
          

            let newGoose = new Goose(3, newRandomValue, newColor);
            squares[newRandomValue] = newGoose;
            //console.log(this.state.squares);
            this.state.geese.push(newGoose);
            //console.log("goose array : " + this.state.geese[2].position);
          }
          


          if (squares[i].player === 1) {
            if (squares[i].constructor.name === "King") {
              console.log("endgame black wins")
              this.state.connection.send(JSON.stringify({type: "endGame"}))
              alert("Black wins!")

              // send the user back to the lobby
              window.location.href = "/";
            }          
          }
          else {
            if (squares[i].constructor.name === "King") {
              console.log("endgame white wins")
              this.state.connection.send(JSON.stringify({type: "endGame"}))
              alert("White wins!")

              // send the user back to the lobby
              window.location.href = "/";
            }
          }
        }
        if (squares[this.state.sourceSelection].constructor.name === "Pawn" && Math.abs(this.state.sourceSelection - i) > 8) {
          this.setState(oldState => ({enPassantColumn: i % 8}))
        } else {
          this.setState(oldState => ({enPassantColumn: -2}))
        }
        if (squares[this.state.sourceSelection].constructor.name === "King" || squares[this.state.sourceSelection].constructor.name === "Rook") {
          //console.log(squares[this.state.sourceSelection].moved)
          squares[this.state.sourceSelection].moved = true
        }
        if (isCastle) {
          if (this.state.sourceSelection - i > 0) {
            if (this.state.player === 1) {
              squares[59] = squares[56]
              squares[56] = null
              squares[59].moved = true
            }
            else {
              squares[3] = squares[0]
              squares[0] = null
              squares[3].moved = true
            }
          }
          else {
            if (this.state.player === 1) {
              squares[61] = squares[63]
              squares[63] = null
              squares[61].moved = true
            }
            else {
              squares[5] = squares[7]
              squares[7] = null
              squares[5].moved = true
            }
          }
        }
        
        if (isEnPassant) {
          if (this.state.player === 1) {
            squares[i + 8] = null
          }
          else {
            squares[i - 8] = null
          }
        }
        
        squares[i] = squares[this.state.sourceSelection];
        squares[this.state.sourceSelection] = null;
        

        //const isCheckMe = this.isCheckForPlayer(squares, this.state.player)
        const isCheckMe = false;

        if (isCheckMe) {
          this.setState(oldState => ({
            status: "Wrong selection. Choose valid source and destination again. Now you have a check!",
            sourceSelection: -1,
          }))
        } else {
          let turn = this.state.turn === 'white' ? 'black' : 'white';

          //Pawn Promotion
          if(squares[i].constructor.name === "Pawn" ) {
            if(i === 0 || i === 1 ||
               i === 2 || i === 3 ||
               i === 4 || i === 5 ||
               i === 6 || i === 7 ) {
              squares[i] = new Queen(1);
               }
              if(i === 56 || i === 57 ||
                i === 58 || i === 59 ||
                i === 60 || i === 61 ||
                i === 62 || i === 63 ) {
              squares[i] = new Queen(2);
            } 
          }

          
          await this.setState(oldState => ({
            sourceSelection: -1,
            squares: squares,
            status: '',
            turn
          }));
          
        }

        //goosemove
        for(let i = 0; i < this.state.geese.length; i++) {
          let position = this.state.geese[i].position;
          let possiblePositions = [];


          if (position === 0 || position === 8 || position === 16 || position === 24 || position === 32 || 
            position === 40 || position === 48 || position === 56) {
              if (squares[position - 8] === null) {
                possiblePositions.push(position - 8);
              }
              if (squares[position - 7] === null) {
                possiblePositions.push(position - 7);
              }
              if (squares[position + 1] === null) {
                possiblePositions.push(position + 1);
              }
              if (squares[position + 9] === null) {
                possiblePositions.push(position + 9);
              }
              if (squares[position + 8] === null) {
                possiblePositions.push(position + 8);
              }
            } else if (position === 7 || position === 15 || position === 23 || position === 31 || position === 39 || 
              position === 47 || position === 55 || position === 63) {
                if (squares[position - 9] === null) {
                  possiblePositions.push(position - 9);
                }
                if (squares[position - 8] === null) {
                  possiblePositions.push(position - 8);
                }
                if (squares[position + 8] === null) {
                  possiblePositions.push(position + 8);
                }
                if (squares[position + 7] === null) {
                  possiblePositions.push(position + 7);
                }
                if (squares[position - 1] === null) {
                  possiblePositions.push(position - 1);
                }
            } else {
          if (squares[position - 9] === null) {
            possiblePositions.push(position - 9);
          }
          if (squares[position - 8] === null) {
            possiblePositions.push(position - 8);
          }
          if (squares[position - 7] === null) {
            possiblePositions.push(position - 7);
          }
          if (squares[position + 1] === null) {
            possiblePositions.push(position + 1);
          }
          if (squares[position + 9] === null) {
            possiblePositions.push(position + 9);
          }
          if (squares[position + 8] === null) {
            possiblePositions.push(position + 8);
          }
          if (squares[position + 7] === null) {
            possiblePositions.push(position + 7);
          }
          if (squares[position - 1] === null) {
            possiblePositions.push(position - 1);
          }
        }
        if(possiblePositions.length === 0) {
          if(position === 0) {
            possiblePositions.push(1);
            possiblePositions.push(8);
            possiblePositions.push(9);
          } else if(position === 7) {
            possiblePositions.push(6);
            possiblePositions.push(14);
            possiblePositions.push(15);
          } else if(position === 56) {
            possiblePositions.push(48);
            possiblePositions.push(49);
            possiblePositions.push(57);
          } else if(position === 63) {
            possiblePositions.push(62);
            possiblePositions.push(54);
            possiblePositions.push(55);
          } else if(position === 8 || position === 16 || position === 24 || position === 32 || 
          position === 40 || position === 48){
            possiblePositions.push(position - 8);
            possiblePositions.push(position - 7);
            possiblePositions.push(position + 8);
            possiblePositions.push(position + 9);
            possiblePositions.push(position + 1);
          } else if(position === 15 || position === 23 || position === 31 || position === 39 || 
          position === 47 || position === 55) {
            possiblePositions.push(position - 9);
            possiblePositions.push(position - 8);
            possiblePositions.push(position - 1);
            possiblePositions.push(position + 7);
            possiblePositions.push(position + 8);
          } else if(position === 1 || position === 2 || position === 3 || position === 4 || 
          position === 5 || position === 6) {
            possiblePositions.push(position - 1);
            possiblePositions.push(position + 1);
            possiblePositions.push(position + 7);
            possiblePositions.push(position + 8);
            possiblePositions.push(position + 9);
          } else if(position === 57 || position === 58 || position === 59 || position === 60 || 
          position === 61 || position === 62) {
            possiblePositions.push(position - 7);
            possiblePositions.push(position - 8);
            possiblePositions.push(position - 9);
            possiblePositions.push(position - 1);
            possiblePositions.push(position + 1);
          } else {
            possiblePositions.push(position - 9);
            possiblePositions.push(position - 8);
            possiblePositions.push(position - 7);
            possiblePositions.push(position + 9);
            possiblePositions.push(position + 8);
            possiblePositions.push(position + 7);
            possiblePositions.push(position - 1);
            possiblePositions.push(position + 1);
          }
          let gooseCaptureSquare = possiblePositions[Math.floor(Math.random() * (possiblePositions.length))];

          squares[gooseCaptureSquare] = squares[position];
          squares[position] = null;
          await this.state.geese[i].changePosition(gooseCaptureSquare);
          gooseCaptureSquare = null;
        } else {
            //console.log("Original Position : " + position);
            //console.log("Possible positions : " + possiblePositions);
            let newPositionIndex = Math.floor(Math.random() * (possiblePositions.length));
            
            //console.log("New Position : " + possiblePositions[newPositionIndex]);

            squares[possiblePositions[newPositionIndex]] = squares[position];
            squares[position] = null;
            //this.Goose.position = possiblePositions[newPositionIndex];
            await this.state.geese[i].changePosition(possiblePositions[newPositionIndex]);
          }
        }

        await this.setState({squares: squares})

        // Send new board to the server for the other player to recieve.
        console.log("Sending data");
        console.log(this.state.squares);
        console.log(this.serialize());
        this.state.connection.send(JSON.stringify({type: "boardUpdate", data: this.serialize()}));

      } else {
        this.setState({
          status: "Wrong selection. Choose valid source and destination again.",
          sourceSelection: -1
        });
      }
    }
  }

  getKingPosition(squares, player) {
    return squares.reduce((acc, curr, i) =>
      acc || //King may be only one, if we had found it, returned his position
      ((curr //current squre mustn't be a null
        && (curr.getPlayer() === player)) //we are looking for aspecial king 
        && (curr instanceof King)
        && i), // returned position if all conditions are completed
      null)
  }

  isCheckForPlayer(squares, player) {
    const opponent = player === 1 ? 2 : 1
    const playersKingPosition = this.getKingPosition(squares, player)
    const canPieceKillPlayersKing = (piece, i) => piece.isMovePossible(playersKingPosition, i, squares)
    return squares.reduce((acc, curr, idx) =>
      acc ||
      (curr &&
        (curr.getPlayer() === opponent) &&
        canPieceKillPlayersKing(curr, idx)
        && true),
      false)
  }

    /**
   * Check all path indices are null. For one steps move of pawn/others or jumping moves of knight array is empty, so  move is legal.
   * @param  {[type]}  srcToDestPath [array of board indices comprising path between src and dest ]
   * @return {Boolean}               
   */

  isMoveLegal(srcToDestPath){
    let isLegal = true;
    for(let i = 0; i < srcToDestPath.length; i++){
      if(this.state.squares[srcToDestPath[i]] !== null){
        isLegal = false;
      }
    }
    return isLegal;
  }

  serialize() {
    let serializedState = {}
    serializedState.squares = []
    for (let i = 0; i < this.state.squares.length; i++) {
      if (this.state.squares[i]) {
        serializedState.squares.push({})
        serializedState.squares[i].type = this.state.squares[i].constructor.name
        serializedState.squares[i].player = this.state.squares[i].player
        if (serializedState.squares[i].type === "King" || serializedState.squares[i].type === "Rook") {
          serializedState.squares[i].moved = this.state.squares[i].moved
        }
        if (serializedState.squares[i].type === "Goose") {
          serializedState.squares[i].color = this.state.squares[i].color
          serializedState.squares[i].position = this.state.squares[i].position
        }
      } else {
        serializedState.squares.push(null)
      }
    }
    serializedState.enPassantColumn = this.state.enPassantColumn;
    serializedState.numberOfFallenSoldiers = this.state.numberOfFallenSoldiers;
    serializedState.geeseColors = this.state.geeseColors
    return JSON.stringify(serializedState)
  }

  deserialize(str) {
    let obj;
    try {
      obj = JSON.parse(str)
    } catch (ex) {
      console.error(ex)
      return;
    }
    let newSquares = []
    let newGeese = []
    for (let i = 0; i < obj.squares.length; i++) {
      if (!obj.squares[i]) {
        newSquares.push(null)
      } else {
        switch (obj.squares[i].type) {
          case "King":
            newSquares.push(new King(obj.squares[i].player))
            newSquares[i].moved = obj.squares[i].moved
            break;
          case "Queen":
            newSquares.push(new Queen(obj.squares[i].player))
            break;
          case "Bishop":
            newSquares.push(new Bishop(obj.squares[i].player))
            break;
          case "Knight":
            newSquares.push(new Knight(obj.squares[i].player))
            break;
          case "Rook":
            newSquares.push(new Rook(obj.squares[i].player))
            newSquares[i].moved = obj.squares[i].moved
            break;
          case "Pawn":
            newSquares.push(new Pawn(obj.squares[i].player))
            break;
          case "Goose":
            newSquares.push(new Goose(3, obj.squares[i].position, obj.squares[i].color))
            newGeese.push(newSquares[i])
            break;
          default:
            console.log("Undefined type given")
        }
      }
    }

    

    this.setState({
      squares: newSquares,
      geese: newGeese,
      enPassantColumn: obj.enPassantColumn,
      numberOfFallenSoldiers: obj.numberOfFallenSoldiers,
      geeseColors: obj.geeseColors,
    })

    
  }

  render() {

    return (
      <div>
        <div className="game">
          <div className="game-board">
            <Board
            
              squares={this.state.squares}
              onClick={(i) => this.handleClick(i)}
            />
          </div>
          <div className="game-info">
            <h3>Turn</h3>
            <div className="player-turn-box-container">
              <div id="player-turn-box" style={{ backgroundColor: this.state.turn }}>
            </div>
            </div>
            <div className="game-status">{this.state.status}</div>
          </div>
        </div>
      </div>


    );
  }
}

