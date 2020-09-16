// chess.cpp
// @author octopoulo <polluxyz@gmail.com>
// @version 2020-09-12
// - wasm implementation, 25x faster than original, and 2x faster than fast chess.js
// - FRC support
// - emcc --bind -o ../js/chess-wasm.js chess.cpp -s WASM=1 -Wall -s MODULARIZE=1 -O3 --closure 1

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <algorithm>
#include <iostream>
#include <map>
#include <regex>
#include <stdio.h>

using namespace emscripten;

#define DELETE(x) {if (x) delete x; x = nullptr;}
#define DELETE_ARRAY(x) {if (x) delete [] x; x = nullptr;}

// defines
#define BISHOP 3
#define BITS_BIG_PAWN 4
#define BITS_CAPTURE 2
#define BITS_CASTLE 96
#define BITS_EP_CAPTURE 8
#define BITS_KSIDE_CASTLE 32
#define BITS_NORMAL 1
#define BITS_PROMOTION 16
#define BITS_QSIDE_CASTLE 64
#define BLACK 1
#define COLOR(piece) (piece >> 3)
#define COLOR_TEXT(color) ((color == 0)? 'w': 'b')
#define COLORIZE(color, type) (type + (color << 3))
#define DEFAULT_POSITION "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
#define EMPTY -1
#define FILE(square) (square & 15)
#define FILE_ALGEBRAIC(square) ('a' + FILE(square))
#define KING 6
#define KNIGHT 2
#define PAWN 1
#define PIECE_LOWER " pnbrqk  pnbrqk"
#define PIECE_NAMES " PNBRQK  pnbrqk"
#define PIECE_UPPER " PNBRQK  PNBRQK"
#define QUEEN 5
#define RANK(square) (square >> 4)
#define RANK_ALGEBRAIC(square) ('8' - RANK(square))
#define ROOK 4
#define SQUARE_A8 0
#define SQUARE_H1 119
#define TYPE(piece) (piece & 7)
#define WHITE 0

// tables
int ATTACKS[] = {
       20, 0, 0, 0, 0, 0, 0,24, 0, 0, 0, 0, 0, 0,20, 0,
        0,20, 0, 0, 0, 0, 0,24, 0, 0, 0, 0, 0,20, 0, 0,
        0, 0,20, 0, 0, 0, 0,24, 0, 0, 0, 0,20, 0, 0, 0,
        0, 0, 0,20, 0, 0, 0,24, 0, 0, 0,20, 0, 0, 0, 0,
        0, 0, 0, 0,20, 0, 0,24, 0, 0,20, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,20, 2,24, 2,20, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 2,53,56,53, 2, 0, 0, 0, 0, 0, 0,
       24,24,24,24,24,24,56, 0,56,24,24,24,24,24,24, 0,
        0, 0, 0, 0, 0, 2,53,56,53, 2, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,20, 2,24, 2,20, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,20, 0, 0,24, 0, 0,20, 0, 0, 0, 0, 0,
        0, 0, 0,20, 0, 0, 0,24, 0, 0, 0,20, 0, 0, 0, 0,
        0, 0,20, 0, 0, 0, 0,24, 0, 0, 0, 0,20, 0, 0, 0,
        0,20, 0, 0, 0, 0, 0,24, 0, 0, 0, 0, 0,20, 0, 0,
       20, 0, 0, 0, 0, 0, 0,24, 0, 0, 0, 0, 0, 0,20,
    },
    ATTACK_BITS[] = {0, 1, 2, 4, 8, 16, 32},
    PAWN_OFFSETS[2][4] = {
        {-16, -32, -17, -15},
        {16, 32, 17, 15},
    },
    // move ordering
    PIECE_CAPTURES[] = {
        0,
        20100,      // P
        20300,      // N
        20300,      // B
        20500,      // R
        20900,      // Q
        32800,      // K
        0,
        0,
        20100,      // p
        20300,      // n
        20300,      // b
        20500,      // r
        20900,      // q
        32800,      // k
        0,
    },
    PIECE_OFFSETS[7][8] = {
        {  0,   0,   0,   0,  0,  0,  0,  0},
        {  0,   0,   0,   0,  0,  0,  0,  0},
        {-18, -33, -31, -14, 18, 33, 31, 14},
        {-17, -15,  17,  15,  0,  0,  0,  0},
        {-16,   1,  16,  -1,  0,  0,  0,  0},
        {-17, -16, -15,   1, 17, 16, 15, -1},
        {-17, -16, -15,   1, 17, 16, 15, -1},
    },
    // move ordering
    PIECE_ORDERS[] = {
        0,
        4,          // P
        1,          // N
        1,          // B
        2,          // R
        3,          // Q
        5,          // K
        0,
        0,
        4,          // p
        1,          // n
        1,          // b
        2,          // r
        3,          // q
        5,          // k
        0,
    },
    // material eval
    PIECE_SCORES[] = {
        0,
        100,        // P
        300,        // N
        300,        // B
        500,        // R
        900,        // Q
        12800,      // K
        0,
        0,
        100,        // p
        300,        // n
        300,        // b
        500,        // r
        900,        // q
        12800,      // k
        0,
    },
    PROMOTE_SCORES[] = {
        0,
        0,          // P
        200,        // N
        200,        // B
        400,        // R
        800,        // Q
        11800,      // K
        0,
        0,
        0,          // p
        200,        // n
        200,        // b
        400,        // r
        800,        // q
        11800,      // k
        0,
    },
    RAYS[] = {
       17,  0,  0,  0,  0,  0,  0, 16,  0,  0,  0,  0,  0,  0, 15, 0,
        0, 17,  0,  0,  0,  0,  0, 16,  0,  0,  0,  0,  0, 15,  0, 0,
        0,  0, 17,  0,  0,  0,  0, 16,  0,  0,  0,  0, 15,  0,  0, 0,
        0,  0,  0, 17,  0,  0,  0, 16,  0,  0,  0, 15,  0,  0,  0, 0,
        0,  0,  0,  0, 17,  0,  0, 16,  0,  0, 15,  0,  0,  0,  0, 0,
        0,  0,  0,  0,  0, 17,  0, 16,  0, 15,  0,  0,  0,  0,  0, 0,
        0,  0,  0,  0,  0,  0, 17, 16, 15,  0,  0,  0,  0,  0,  0, 0,
        1,  1,  1,  1,  1,  1,  1,  0, -1, -1,  -1,-1, -1, -1, -1, 0,
        0,  0,  0,  0,  0,  0,-15,-16,-17,  0,  0,  0,  0,  0,  0, 0,
        0,  0,  0,  0,  0,-15,  0,-16,  0,-17,  0,  0,  0,  0,  0, 0,
        0,  0,  0,  0,-15,  0,  0,-16,  0,  0,-17,  0,  0,  0,  0, 0,
        0,  0,  0,-15,  0,  0,  0,-16,  0,  0,  0,-17,  0,  0,  0, 0,
        0,  0,-15,  0,  0,  0,  0,-16,  0,  0,  0,  0,-17,  0,  0, 0,
        0,-15,  0,  0,  0,  0,  0,-16,  0,  0,  0,  0,  0,-17,  0, 0,
      -15,  0,  0,  0,  0,  0,  0,-16,  0,  0,  0,  0,  0,  0,-17,
    };

float
    MOBILITY_SCORES[] = {
        0,
        1,          // P
        6,          // N
        3,          // B
        3,          // R
        0.3,        // Q
        0,          // K
        0,
        0,
        1,          // p
        6,          // n
        3,          // b
        3,          // r
        0.3,        // q
        0,          // k
        0,
    };

// extras
std::map<std::string, uint8_t> EVAL_MODES = {
    {"hce", 1 + 2},
    {"mat", 1},
    {"mob", 2},
    {"nn", 1 + 2 + 8},
    {"null", 0},
    {"qui", 1 + 2 + 4},
};
std::map<char, uint8_t> PIECES = {
    {'P', 1},
    {'N', 2},
    {'B', 3},
    {'R', 4},
    {'Q', 5},
    {'K', 6},
    {'p', 9},
    {'n', 10},
    {'b', 11},
    {'r', 12},
    {'q', 13},
    {'k', 14},
};
std::map<std::string, uint8_t> SEARCH_MODES = {
    {"ab", 2},
    {"mm", 1},
    {"rnd", 0},
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

struct Move {
    uint8_t capture;
    uint8_t flags;
    uint8_t from;
    std::string m;          // san
    uint8_t piece;
    uint8_t promote;
    uint8_t to;
};

struct MoveText: Move {
    std::string fen;
    int     ply;
    int     score;

    MoveText(): Move() {}
    MoveText(const Move &move) {
        memcpy(this, &move, sizeof(Move));
        ply = -1;
        score = 0;
    }
};

struct State {
    int     castling[4];
    int     ep_square;
    int     half_moves;
    int     kings[2];
    Move    move;
};

Move NULL_MOVE = {0, 0, 0, "", 0, 0, 0};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// chess class
class Chess {
private:
    // PRIVATE
    //////////

    int     avg_depth;
    uint8_t board[128];
    int     castling[4];
    int     ep_square;
    uint8_t eval_mode;                      // 0:null, &1:mat, &2:hc2, &4:qui, &8:nn
    std::string fen;
    bool    frc;
    int     half_moves;
    int     idepth;
    int     kings[2];
    int     materials[2];
    int     max_depth;
    int     max_nodes;
    int     max_time;
    uint8_t mobilities[16];
    int     move_number;
    int     nodes;
    int     ply;
    std::vector<State> ply_states;
    int     search_mode;                    // 0:minimax, 1:alpha-beta
    int     sel_depth;
    uint8_t turn;

    /**
     * Add a move + promote moves
     */
    void addMove(std::vector<Move> &moves, uint8_t piece, int from, int to, uint8_t flags) {
        // pawn promotion?
        int rank = RANK(to);
        if (TYPE(piece) == PAWN && (rank % 7) == 0) {
            for (uint8_t promote = QUEEN; promote >= KNIGHT; promote --)
                addSingleMove(moves, piece, from, to, flags | BITS_PROMOTION, promote);
        }
        else
            addSingleMove(moves, piece, from, to, flags, 0);

        mobilities[piece] ++;
    }

    /**
     * Add a single move
     */
    void addSingleMove(std::vector<Move> &moves, uint8_t piece, uint8_t from, uint8_t to, uint8_t flags, uint8_t promote) {
        uint8_t capture = 0;
        if (!(flags & BITS_CASTLE)) {
            if (board[to])
                capture = TYPE(board[to]);
            else if (flags & BITS_EP_CAPTURE)
                capture = PAWN;
        }
        moves.push_back({capture, flags, from, "", piece, promote, to});
    }

    /**
     * Add a ply state
     */
    void addState(Move &move) {
        for (auto i = ply_states.size(); i < ply + 2; i ++)
            ply_states.emplace_back();

        auto &state = ply_states[ply + 1];
        memcpy(state.castling, castling, sizeof(castling));
        state.ep_square = ep_square;
        state.half_moves = half_moves;
        memcpy(state.kings, kings, sizeof(kings));
        memcpy(&state.move, &move, sizeof(Move));
    }

    /**
     * Move ordering for alpha-beta
     * - captures
     * - castle
     * - nb/r/q/r/p
     */
    static bool compareMoves(const Move &a, const Move &b) {
        if (a.capture || b.capture)
            return (PIECE_CAPTURES[b.capture] - PIECE_CAPTURES[a.capture]) * 10 + PIECE_SCORES[a.piece] - PIECE_SCORES[b.piece] < 0;
        auto castle = !!(b.flags & BITS_CASTLE) - !!(a.flags & BITS_CASTLE);
        if (castle)
            return castle < 0;
        if (a.promote || b.promote)
            return b.promote < a.promote;
        auto aorder = PIECE_ORDERS[a.piece],
            border = PIECE_ORDERS[b.piece];
        if (aorder == border) {
            // more advanced pawn => higher priority
            if (aorder == 4)
                return COLOR(a.piece)? (RANK(b.to) < RANK(a.to)): (RANK(a.to) < RANK(b.to));
            return 0;
        }
        return aorder < border;
    }

    /**
     * Uniquely identify ambiguous moves
     */
    std::string disambiguate(Move &move, std::vector<Move> &moves) {
        int ambiguities = 0,
            from = move.from,
            same_file = 0,
            same_rank = 0,
            to = move.to;
        uint8_t type = TYPE(move.piece);

        for (auto &move2 : moves) {
            int ambig_from = move2.from,
                ambig_to = move2.to;

            // if a move of the same piece type ends on the same to square,
            // we'll need to add a disambiguator to the algebraic notation
            if (type == TYPE(move2.piece) && from != ambig_from && to == ambig_to) {
                ambiguities ++;

                if (RANK(from) == RANK(ambig_from))
                    same_rank ++;
                if (FILE(from) == FILE(ambig_from))
                    same_file ++;
            }
        }

        if (!ambiguities)
            return "";

        auto an = squareToAn(from, false);
        if (same_rank > 0 && same_file > 0)
            return an;
        else
            return an.substr((same_file > 0)? 1: 0, 1);
    }

public:
    // PUBLIC
    /////////

    Chess() {
        configure(false, "", 4);
        clear();
        load(DEFAULT_POSITION);
    }
    ~Chess() {
    }

    /**
     * Convert AN to square
     * - 'a' = 97
     * - '8' = 56
     * @param an c2
     * @return 98
     */
    uint8_t anToSquare(std::string an) {
        if (an.size() < 2)
            return EMPTY;
        int file = an[0] - 'a',
            rank = '8' - an[1];
        return file + (rank << 4);
    }

    /**
     * Check if a square is attacked by a color
     * @param color attacking color
     * @param square .
     * @return true if the square is attacked
     */
    bool attacked(uint8_t color, int square) {
        for (int i = SQUARE_A8; i <= SQUARE_H1; i ++) {
            // off board
            if (i & 0x88) {
                i += 7;
                continue;
            }

            // if empty square or wrong color
            auto piece = board[i];
            if (!piece)
                continue;

            auto piece_color = COLOR(piece);
            if (piece_color != color)
                continue;

            int difference = i - square,
                index = difference + 119;
            auto piece_type = TYPE(piece);

            if (!(ATTACKS[index] & ATTACK_BITS[piece_type]))
                continue;

            // knight + king
            if (piece_type == KING || piece_type == KNIGHT)
                return true;

            // pawn
            if (piece_type == PAWN) {
                if (difference > 0) {
                    if (piece_color == WHITE)
                        return true;
                }
                else if (piece_color == BLACK)
                    return true;
                continue;
            }

            // others => cannot be blocked
            bool blocked = false;
            int offset = RAYS[index],
                j = i + offset;

            while (j != square) {
                if (board[j]) {
                    blocked = true;
                    break;
                }
                j += offset;
            }
            if (!blocked)
                return true;
        }

        return false;
    }

    /**
     * Remove decorators from the SAN
     * @param san Bxe6+!!
     * @return clean san Bxe6
     */
    std::string cleanSan(std::string san) {
        int i = san.size() - 1;
        for (; i >= 0 && strchr("+#?!", san[i]); i --)
            san.erase(i, 1);
        for (; i >= 0; i --)
            if (san[i] == '=') {
                san.erase(i, 1);
                break;
            }

        return san;
    }

    /**
     * Clear the board
     */
    void clear() {
        avg_depth = 0;
        memset(board, 0, sizeof(board));
        memset(castling, EMPTY, sizeof(castling));
        ep_square = EMPTY;
        fen = "";
        half_moves = 0;
        idepth = 0;
        memset(kings, EMPTY, sizeof(kings));
        memset(materials, 0, sizeof(materials));
        memset(mobilities, 0, sizeof(mobilities));
        move_number = 1;
        nodes = 0;
        ply = -1;
        ply_states.clear();
        sel_depth = 0;
        turn = WHITE;
    }

    /**
     * Configure parameters
     */
    void configure(bool frc_, std::string options, int depth) {
        eval_mode = 1;
        frc = frc_;
        if (depth >= 0)
            max_depth = depth;
        max_nodes = 1e9;
        max_time = 0;
        search_mode = 0;

        // parse the line
        std::regex re("\\s+");
        std::sregex_token_iterator it(options.begin(), options.end(), re, -1);
        std::sregex_token_iterator reg_end;
        for (; it != reg_end; it ++) {
            auto option = it->str();
            if (option.size() < 3 || option.at(1) != '=')
                continue;
            auto left = option.at(0);
            auto right = option.substr(2);
            auto value = std::atoi(right.c_str());
            switch (left) {
            case 'd':
                if (value >= 0)
                    max_depth = value;
                else if (value < 0)
                    max_time = -value;
                break;
            case 'e': {
                    auto eit = EVAL_MODES.find(right);
                    if (eit != EVAL_MODES.end())
                        eval_mode = eit->second;
                }
                break;
            case 'n':
                max_nodes = value;
                break;
            case 's': {
                    auto sit = SEARCH_MODES.find(right);
                    if (sit != SEARCH_MODES.end())
                        search_mode = sit->second;
                }
                break;
            case 't':
                max_time = value;
                break;
            }
        }
    }

    /**
     * Count the piece mobilities
     */
    void countMobilities() {
        memset(mobilities, 0, sizeof(mobilities));

        for (int i = SQUARE_A8; i <= SQUARE_H1; i ++) {
            // off board
            if (i & 0x88) {
                i += 7;
                continue;
            }

            auto piece = board[i];
            if (!piece)
                continue;

            auto piece_type = TYPE(piece),
                us = COLOR(piece),
                them = us ^ 1;

            if (piece_type == PAWN) {
                int *offsets = PAWN_OFFSETS[us];

                // single square, non-capturing
                int square = i + offsets[0];
                if (!board[square]) {
                    mobilities[piece] ++;

                    // double square
                    square = i + offsets[1];
                    if (6 - us * 5 == RANK(i) && !board[square])
                        mobilities[piece] ++;
                }

                // pawn captures
                for (int j = 2; j < 4; j ++) {
                    square = i + offsets[j];
                    if (square & 0x88)
                        continue;

                    if (board[square] && COLOR(board[square]) == them)
                        mobilities[piece] ++;
                    else if (square == ep_square)
                        mobilities[piece] ++;
                }
            }
            else {
                int *offsets = PIECE_OFFSETS[piece_type];
                for (int j = 0; j < 8; j ++) {
                    int offset = offsets[j],
                        square = i;
                    if (!offset)
                        break;

                    while (true) {
                        square += offset;
                        if (square & 0x88)
                            break;

                        if (!board[square])
                            mobilities[piece] ++;
                        else {
                            if (COLOR(board[square]) == us)
                                break;
                            mobilities[piece] ++;
                            break;
                        }

                        // break if knight or king
                        if (piece_type == KING || piece_type == KNIGHT)
                            break;
                    }
                }
            }
        }
    }

    /**
     * Create the FEN
     * @return fen
     */
    std::string createFen() {
        int empty = 0;
        fen = "";

        for (int i = SQUARE_A8; i <= SQUARE_H1; i ++) {
            auto piece = board[i];
            if (!piece)
                empty ++;
            else {
                if (empty > 0) {
                    fen += ('0' + empty);
                    empty = 0;
                }
                fen += PIECE_NAMES[piece];
            }

            // off board
            if ((i + 1) & 0x88) {
                if (empty > 0)
                    fen += ('0' + empty);
                if (i != SQUARE_H1)
                    fen += '/';

                empty = 0;
                i += 8;
            }
        }

        std::string castle;
        if (frc) {
            for (auto square : castling)
                if (square != EMPTY) {
                    int file = FILE(square),
                        rank = RANK(square);
                    if (rank > 0)
                        castle += (file + 'A');
                    else
                        castle += (file + 'a');
                }
        }
        else {
            if (castling[0] != EMPTY) castle += 'K';
            if (castling[1] != EMPTY) castle += 'Q';
            if (castling[2] != EMPTY) castle += 'k';
            if (castling[3] != EMPTY) castle += 'q';
        }

        // empty castling flag?
        if (castle.empty())
            castle = "-";

        std::string epflags;
        if (ep_square == EMPTY)
            epflags += "-";
        else {
            epflags += FILE_ALGEBRAIC(ep_square);
            epflags += RANK_ALGEBRAIC(ep_square);
        }

        fen = fen + " " + COLOR_TEXT(turn) + " " + castle + " " + epflags + " " + std::to_string(half_moves) + " " + std::to_string(move_number);
        return fen;
    }

    /**
     * Create a Fischer Random 960 FEN
     * http://www.russellcottrell.com/Chess/Chess960.htm
     * @param index between 0 and 959
     */
    std::string createFen960(int index) {
        if (index < 0 || index >= 960)
            return "";

        int i, n1, n2, q;
        std::string line = "        ";

        line[(index % 4) * 2 + 1] = 'B';
        index /= 4;
        line[(index % 4) * 2] = 'B';
        index /= 4;
        q = index % 6;
        index /= 6;

        for (n1 = 0; n1 < 4; n1 ++) {
            n2 = index + ((3 - n1) * (4 - n1)) / 2 - 5;
            if (n1 < n2 && n2 > 0 && n2 < 5)
                break;
        }

        // queen
        for (i = 0; i < 8; i ++)
            if (line[i] == ' ') {
                if (!q) {
                    line[i] = 'Q';
                    break;
                }
                q --;
            }

        // knights
        for (i = 0; i < 8; i ++)
            if (line[i] == ' ') {
                if (!n1 || !n2)
                    line[i] = 'N';
                n1 --;
                n2 --;
            }

        // rook - king - rook
        std::string rooks, rooks2;
        i = 7;
        for (auto type : "RKR")
            for (; i >= 0; i --) {
                if (line[i] == ' ') {
                    line[i] = type;
                    if (type == 'R') {
                        rooks += 'A' + i;
                        rooks2 += 'a' + i;
                    }
                    break;
                }
            }

        std::string result;
        for (auto letter : line)
            result += letter + 'a' - 'A';

        result = result + "/pppppppp/8/8/8/8/PPPPPPPP/" + line + " w " + rooks + rooks2 + " - 0 1";
        return result;
    }

    /**
     * Create the moves
     * @param frc Fisher Random Chess
     * @param legal only consider legal moves
     * @param only_capture
     * @return moves
     */
    std::vector<Move> createMoves(bool frc, bool legal, bool only_capture) {
        std::vector<Move> moves;
        int second_rank = 6 - turn * 5;
        uint8_t us = turn,
            us8 = us << 3,
            them = us ^ 1;

        for (int i = us8; i < us8 + 8; i ++)
            mobilities[i] = 0;

        for (int i = SQUARE_A8; i <= SQUARE_H1; i ++) {
            // off board
            if (i & 0x88) {
                i += 7;
                continue;
            }

            auto piece = board[i];
            if (!piece || COLOR(piece) != us)
                continue;

            auto piece_type = TYPE(piece);
            if (piece_type == PAWN) {
                int *offsets = PAWN_OFFSETS[us];

                // single square, non-capturing
                if (!only_capture) {
                    auto square = i + offsets[0];
                    if (!board[square]) {
                        addMove(moves, piece, i, square, BITS_NORMAL);

                        // double square
                        square = i + offsets[1];
                        if (second_rank == RANK(i) && !board[square])
                            addMove(moves, piece, i, square, BITS_BIG_PAWN);
                    }
                }

                // pawn captures
                for (int j = 2; j < 4; j ++) {
                    auto square = i + offsets[j];
                    if (square & 0x88)
                        continue;

                    if (board[square] && COLOR(board[square]) == them)
                        addMove(moves, piece, i, square, BITS_CAPTURE);
                    else if (square == ep_square)
                        addMove(moves, piece, i, ep_square, BITS_EP_CAPTURE);
                }
            }
            else {
                int *offsets = PIECE_OFFSETS[piece_type];
                for (int j = 0; j < 8; j ++) {
                    int offset = offsets[j],
                        square = i;
                    if (!offset)
                        break;

                    while (true) {
                        square += offset;
                        if (square & 0x88)
                            break;

                        if (!board[square]) {
                            if (!only_capture)
                                addMove(moves, piece, i, square, BITS_NORMAL);
                        }
                        else {
                            if (COLOR(board[square]) == us)
                                break;
                            addMove(moves, piece, i, square, BITS_CAPTURE);
                            break;
                        }

                        // break if knight or king
                        if (piece_type == KING || piece_type == KNIGHT)
                            break;
                    }
                }
            }
        }

        // castling
        if (!only_capture) {
            int king = kings[us];
            if (king != EMPTY) {
                auto pos0 = RANK(king) << 4;

                // q=0: king side, q=1: queen side
                for (auto q = 0; q < 2; q ++) {
                    auto rook = castling[(us << 1) + q];
                    if (rook == EMPTY)
                        continue;

                    int error = false,
                        flags = q? BITS_QSIDE_CASTLE: BITS_KSIDE_CASTLE,
                        king_to = pos0 + 6 - (q << 2),
                        rook_to = king_to - 1 + (q << 1),
                        max_king = std::max(king, king_to),
                        min_king = std::min(king, king_to),
                        max_path = std::max(max_king, std::max(rook, rook_to)),
                        min_path = std::min(min_king, std::min(rook, rook_to));

                    // check that all squares are empty along the path
                    for (auto j = min_path; j <= max_path; j ++)
                        if (j != king && j != rook && board[j]) {
                            error = true;
                            break;
                        }
                    if (error)
                        continue;

                    // check that the king is not attacked
                    for (auto j = min_king; j <= max_king; j ++)
                        if (attacked(them, j)) {
                            error = true;
                            break;
                        }

                    // add castle + detect FRC even if not set
                    if (!error)
                        addMove(moves, COLORIZE(us, KING), king, (frc || FILE(king) != 4 || FILE(rook) % 7)? rook: king_to, flags);
                }
            }
        }

        // move ordering for alpha-beta
        if (search_mode == 2)
            orderMoves(moves);

        // return pseudo-legal moves
        if (!legal)
            return moves;

        // filter out illegal moves
        // TODO: improve this
        std::vector<Move> legal_moves;
        for (auto &move : moves) {
            moveRaw(move);
            if (!kingAttacked(us))
                legal_moves.push_back(std::move(move));
            undoMove();
        }
        return legal_moves;
    }

    /**
     * Decorate the SAN with + or #
     */
    std::string decorateMove(Move &move) {
        auto text = move.m;
        char last = text[text.size() - 1];
        if (last != '+' && last != '#' && kingAttacked(turn)) {
            auto moves = createMoves(frc, true, false);
            text += moves.size()? '+': '#';
            move.m = text;
        }
        return text;
    }

    /**
     * Evaluate the current position
     * - eval_mode: 0:null, 1:mat, 2:hc2, &4:qui, 8:nn
     */
    float evaluate() {
        float score = 0;
        uint8_t us = turn ^ 1,
            them = turn;

        if (eval_mode & 1)
            score = materials[us] - materials[them];

        if (eval_mode & 2) {
            auto count0 = 0,
                count1 = 0;
                // countMobilities();
            for (auto i = 1; i < 7; i ++)
                count0 += mobilities[i] * MOBILITY_SCORES[i];
            for (auto i = 9; i < 15; i ++)
                count1 += mobilities[i] * MOBILITY_SCORES[i];
            if (us)
                score += count1 - count0;
            else
                score += count0 - count1;
        }
        return score;
    }

    /**
     * Check if the king is attacked
     * @param color 0, 1 + special cases: 2, 3
     * @return true if king is attacked
     */
    bool kingAttacked(uint8_t color) {
        if (color > 1)
            color = (color == 2)? turn: turn ^ 1;
        return attacked(color ^ 1, kings[color]);
    }

    /**
     * Load a FEN
     * @param fen valid or invalid FEN
     * @return empty on error, and the FEN may be corrected
     */
    std::string load(std::string fen_) {
        if (fen_.empty())
            return "";

        clear();
        fen = fen_;

        int half = 0,
            move = 0,
            step = 0,
            step2 = 0,
            step3 = 0,
            square = 0;
        std::string castle, ep;

        for (auto i = 0; i < fen.size(); i ++) {
            auto value = fen[i];
            if (value == ' ') {
                step ++;
                if (step == 2)
                    step2 = i;
                else if (step == 3)
                    step3 = i;
                continue;
            }

            switch (step) {
            // pieces
            case 0:
                if (value == '/')
                    square += 8;
                else if (value >= '1' && value <= '9')
                    square += value - '0';
                else {
                    put(PIECES[value], square);
                    square ++;
                }
                break;
            // turn
            case 1:
                turn = (value == 'w')? 0: 1;
                break;
            // castle
            case 2:
                castle += value;
                break;
            // en passant
            case 3:
                ep += value;
                break;
            // 50 moves rule
            case 4:
                half = (half * 10) + value - '0';
                break;
            // move #
            case 5:
                move = (move * 10) + value - '0';
                break;
            }
        }

        ep_square = (ep == "-")? EMPTY: anToSquare(ep);
        half_moves = half;
        move_number = move;
        ply = move_number * 2 - 3 + turn;

        bool start = (!turn && move_number == 1);
        if (start)
            frc = false;

        // can detect FRC if castle is not empty
        if (castle != "-") {
            bool error = false;
            for (auto letter : castle) {
                auto lower = (letter < 'a')? letter + 'a' - 'A': letter,
                    final = (lower == 'k')? 'h': (lower == 'q')? 'a': lower,
                    color = (letter == lower)? 1: 0,
                    square = final - 'a' + ((color? 0: 7) << 4),
                    index = color * 2 + ((square < kings[color])? 1: 0);

                castling[index] = square;
                if (start && TYPE(board[square]) != ROOK)
                    error = true;
                if (final == lower)
                    frc = true;
            }

            // fix corrupted FEN (only for the initial board)
            if (error) {
                castle = "";
                for (uint8_t color = 0; color < 2; color ++) {
                    char file_letter = color? 'a': 'A';
                    auto king = kings[color];

                    for (int i = king + 1; FILE(i) <= 7; i ++)
                        if (TYPE(board[i]) == ROOK) {
                            castling[color * 2] = i;
                            castle += file_letter + FILE(i);
                            break;
                        }

                    for (int i = king - 1; FILE(i) >= 0; i --)
                        if (TYPE(board[i]) == ROOK) {
                            castling[color * 2 + 1] = i;
                            castle += file_letter + FILE(i);
                            break;
                        }
                }
                fen = fen.substr(0, step2) + " " + castle + fen.substr(step3);
                frc = true;
            }
        }
        return fen;
    }

    /**
     * Try an object move
     * @param move {from: 23, to: 7, promote: 5}
     * @param frc Fisher Random Chess
     * @param decorate add + # decorators
     */
    Move moveObject(Move &move, bool frc, bool decorate) {
        uint8_t flags = 0;
        Move move_obj;
        auto moves = createMoves(frc, true, false);

        // FRC castle?
        if (frc && move.from == kings[turn]) {
            if (move.to == castling[turn * 2] || move.to == move.from + 2)
                flags = BITS_KSIDE_CASTLE;
            else if (move.to == castling[turn * 2 + 1] || move.to == move.from - 2)
                flags = BITS_QSIDE_CASTLE;
        }

        // find an existing match + add the SAN
        if (flags) {
            for (auto &move2 : moves)
                if (move2.flags & flags) {
                    move2.m = moveToSan(move2, moves);
                    move_obj = move2;
                    break;
                }
        }
        else
            for (auto &move2 : moves) {
                if (move.from == move2.from && move.to == move2.to
                        && (!move2.promote || TYPE(move.promote) == move2.promote)) {
                    move2.m = moveToSan(move2, moves);
                    move_obj = move2;
                    break;
                }
            }

        // no suitable move?
        if (move_obj.piece) {
            moveRaw(move_obj);
            if (decorate)
                decorateMove(move_obj);
        }
        return move_obj;
    }

    /**
     * Make a raw move, no verification is being performed
     */
    void moveRaw(Move &move) {
        uint8_t us = turn,
            them = us ^ 1;

        // not smart to do it for every move
        addState(move);

        int capture = move.capture,
            flags = move.flags,
            is_castle = (flags & BITS_CASTLE),
            move_from = move.from,
            move_to = move.to;
        auto move_type = TYPE(move.piece);

        half_moves ++;
        ep_square = EMPTY;

        // moved king?
        if (move_type == KING) {
            if (is_castle) {
                int q = (flags & BITS_QSIDE_CASTLE)? 1: 0,
                    king = kings[us],
                    king_to = (RANK(king) << 4) + 6 - (q << 2),
                    rook = castling[(us << 1) + q];

                board[king] = 0;
                board[rook] = 0;
                board[king_to] = COLORIZE(us, KING);
                board[king_to - 1 + (q << 1)] = COLORIZE(us, ROOK);
                move_to = king_to;
            }

            kings[us] = move_to;
            castling[us << 1] = EMPTY;
            castling[(us << 1) + 1] = EMPTY;
        }

        if (!is_castle) {
            if (move_from != move_to) {
                board[move_to] = board[move_from];
                board[move_from] = 0;
            }

            // remove castling if we capture a rook
            if (capture) {
                materials[them] -= PIECE_SCORES[capture];
                if (capture == ROOK) {
                    if (move_to == castling[them << 1])
                        castling[them << 1] = EMPTY;
                    else if (move_to == castling[(them << 1) + 1])
                        castling[(them << 1) + 1] = EMPTY;
                }
                half_moves = 0;
            }

            // remove castling if we move a rook
            if (move_type == ROOK) {
                if (move_from == castling[us << 1])
                    castling[us << 1] = EMPTY;
                else if (move_from == castling[(us << 1) + 1])
                    castling[(us << 1) + 1] = EMPTY;
            }
            // pawn + update 50MR
            else if (move_type == PAWN) {
                // pawn moves 2 squares
                if (flags & BITS_BIG_PAWN)
                    ep_square = move_to + 16 - (turn << 5);
                else {
                    if (flags & BITS_EP_CAPTURE)
                        board[move_to + 16 - (turn << 5)] = 0;
                    if (flags & BITS_PROMOTION) {
                        board[move_to] = COLORIZE(us, move.promote);
                        materials[us] += PROMOTE_SCORES[move.promote];
                    }
                }
                half_moves = 0;
            }
        }

        ply ++;
        if (turn == BLACK)
            move_number ++;
        turn ^= 1;
    }

    /**
     * Try a SAN move
     * @param text Nxb7, a8=Q
     * @param frc Fisher Random Chess
     * @param decorate add + # decorators
     * @param sloppy allow sloppy parser
     */
    Move moveSan(std::string text, bool frc, bool decorate, bool sloppy) {
        auto moves = createMoves(frc, true, false);
        Move move = sanToMove(text, moves, sloppy);
        if (move.piece) {
            moveRaw(move);
            if (decorate)
                decorateMove(move);
        }
        return move;
    }

    /**
     * Convert a move to SAN
     * https://github.com/jhlywa/chess.js
     * r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
     * 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
     * 4. ... Ne7 is technically the valid SAN
     * @param move
     * @param moves
     */
    std::string moveToSan(Move &move, std::vector<Move> &moves) {
        if (move.flags & BITS_KSIDE_CASTLE)
            return "O-O";
        if (move.flags & BITS_QSIDE_CASTLE)
            return "O-O-O";

        std::string disambiguator = disambiguate(move, moves);
        auto move_type = TYPE(move.piece);
        std::string output;

        if (move_type != PAWN)
            output += PIECE_UPPER[move_type] + disambiguator;

        if (move.flags & (BITS_CAPTURE | BITS_EP_CAPTURE)) {
            if (move_type == PAWN)
                output += squareToAn(move.from, false)[0];
            output += 'x';
        }

        output += squareToAn(move.to, false);

        if (move.flags & BITS_PROMOTION) {
            output += '=';
            output += PIECE_UPPER[move.promote];
        }
        return output;
    }

    /**
     * Try an UCI move
     * @param text c2c4, a7a8a
     * @param frc Fisher Random Chess
     * @param decorate add + # decorators
     */
    Move moveUci(std::string text, bool frc, bool decorate) {
        Move move = {0, 0, anToSquare(text.substr(0, 2)), "", 0, PIECES[text[4]], anToSquare(text.substr(2, 2))};
        return moveObject(move, frc, decorate);
    }

    /**
     * Parse a list of SAN moves + create FEN for each move
     * @param text c2c4 a7a8a ...
     * @param frc Fisher Random Chess
     * @param sloppy allow sloppy parser
     */
    std::vector<MoveText> multiSan(std::string multi, bool frc, bool sloppy) {
        std::vector<MoveText> result;
        int prev = 0,
            size = multi.size();
        for (int i = 0; i <= size; i ++) {
            if (i < size && multi[i] != ' ')
                continue;

            if (multi[prev] >= 'A') {
                auto text = multi.substr(prev, i - prev);
                auto moves = createMoves(frc, true, false);
                Move move = sanToMove(text, moves, sloppy);
                if (!move.piece)
                    break;
                moveRaw(move);
                MoveText move_obj = move;
                move_obj.fen = createFen();
                move_obj.ply = ply;
                move_obj.score = 0;
                result.emplace_back(move_obj);
            }
            prev = i + 1;
        }
        return result;
    }

    /**
     * Parse a list of UCI moves + create SAN + FEN for each move
     * @param text c2c4 a7a8a ...
     * @param frc Fisher Random Chess
     */
    std::vector<MoveText> multiUci(std::string multi, bool frc) {
        std::vector<MoveText> result;
        int prev = 0,
            size = multi.size();
        for (int i = 0; i <= size; i ++) {
            if (i < size && multi[i] != ' ')
                continue;

            if (multi[prev] >= 'A') {
                auto text = multi.substr(prev, i - prev);
                auto move = moveUci(text, frc, true);
                if (move.piece) {
                    MoveText move_obj = move;
                    move_obj.fen = createFen();
                    move_obj.ply = ply;
                    move_obj.score = 0;
                    result.emplace_back(move_obj);
                }
            }
            prev = i + 1;
        }
        return result;
    }

    /**
     * Move ordering for alpha-beta
     * - captures
     * - castle
     * - nb/r/q/r/p
     */
    void orderMoves(std::vector<Move> &moves) {
        std::stable_sort(moves.begin(), moves.end(), compareMoves);
    }

    /**
     * Get params
     */
    std::vector<int> params() {
        std::vector<int> result = {
            max_depth,          // 0
            eval_mode,          // 1
            max_nodes,          // 2
            search_mode,        // 3
            max_time,           // 4
        };
        return result;
    }

    /**
     * Print the board
     */
    std::string print() {
        std::string text;
        for (auto i = SQUARE_A8; i <= SQUARE_H1; i ++) {
            // off board
            if (i & 0x88) {
                i += 7;
                text += '\n';
                continue;
            }
            text += PIECE_NAMES[board[i]];
        }
        return text;
    }

    /**
     * Put a piece on a square
     */
    void put(uint8_t piece, int square) {
        board[square] = piece;
        if (TYPE(piece) == KING)
            kings[COLOR(piece)] = square;
        else
            materials[COLOR(piece)] += PIECE_SCORES[piece];
    }

    /**
     * Reset the board to the default position
     */
    void reset() {
        frc = false;
        load(DEFAULT_POSITION);
    }

    /**
     * Convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
     * @param san Nf3, Nf3+?!
     * @param moves list of moves to match the san against
     * @param sloppy allow sloppy parser
     */
    Move sanToMove(std::string san, std::vector<Move> &moves, bool sloppy) {
        // 1) try exact matching
        auto clean = cleanSan(san);
        for (auto &move : moves)
            if (clean == cleanSan(moveToSan(move, moves))) {
                move.m = san;
                return move;
            }

        // 2) try sloppy matching
        if (!sloppy)
            return NULL_MOVE;

        int from_file = -1,
            from_rank = -1,
            i = clean.size() - 1,
            to = EMPTY;
        uint8_t promote = 0,
            type = 0;

        if (i < 2)
            return NULL_MOVE;

        // analyse backwards
        if (strchr("bnrqBNRQ", clean[i])) {
            promote = TYPE(PIECES[clean[i]]);
            i --;
        }
        // to
        if (clean[i] < '1' || clean[i] > '8')
            return NULL_MOVE;
        i --;
        if (clean[i] < 'a' || clean[i] > 'j')
            return NULL_MOVE;
        to = clean[i] - 'a' + (('8' - clean[i + 1]) << 4);
        i --;
        //
        if (i >= 0 && clean[i] == 'x')
            i --;
        // from
        if (i >= 0 && clean[i] >= '1' && clean[i] <= '8') {
            from_rank = '8' - clean[i];
            i --;
        }
        if (i >= 0 && clean[i] >= 'a' && clean[i] <= 'j') {
            from_file = clean[i] - 'a';
            i --;
        }
        // type
        type = TYPE(PIECES[clean[i]]);

        for (auto &move : moves) {
            if (to == move.to
                    && (!type || type == TYPE(move.piece))
                    && (from_file < 0 || from_file == FILE(move.from))
                    && (from_rank < 0 || from_rank == RANK(move.from))
                    && (!promote || promote == move.promote)) {
                move.m = moveToSan(move, moves);
                return move;
            }
        }
        return NULL_MOVE;
    }

    /**
     * Basic tree search with mask
     * https://www.chessprogramming.org/Principal_Variation_Search
     * @param moves
     * @param mask moves to search, ex: 'b8c6 b8a6 g8h6'
     * @return updated moves
     */
    std::vector<MoveText> search(std::vector<Move> &moves, std::string mask) {
        avg_depth = 0;
        nodes = 0;
        sel_depth = 0;

        auto empty = !mask.size();
        std::vector<MoveText> masked;

        for (auto &move : moves) {
            auto uci = ucify(move);
            if (empty || mask.find(uci) != std::string::npos) {
                std::vector<Move> one;
                one.push_back(move);
                auto score = searchMoves(one, max_depth - 1, -99999, 99999);
                MoveText move_obj = move;
                move_obj.score = score;
                masked.emplace_back(move_obj);
            }
        }
        return masked;
    }

    /**
     * Basic tree search
     * @param moves
     * @param depth
     * @param alpha
     * @param beta
     */
    float searchMoves(std::vector<Move> &moves, int depth, float alpha, float beta) {
        float best = -99999;
        bool look_deeper = (depth > 0 && nodes < max_nodes);
        int valid = 0;

        idepth = max_depth - depth;
        if (idepth > avg_depth)
            avg_depth = idepth;

        for (auto &move : moves) {
            moveRaw(move);
            float score;

            // invalid move?
            if (kingAttacked(3))
                score = -99900;
            else if (half_moves >= 50) {
                score = 0;
                valid ++;
            }
            else {
                valid ++;

                // look deeper
                if (look_deeper) {
                    auto moves2 = createMoves(frc, false, false);
                    score = -searchMoves(moves2, depth - 1, -beta, -alpha);

                    // stalemate? good if we're losing, otherwise BAD!
                    if (score > 80000)
                        score = 0;
                    if (search_mode == 2 && score >= beta) {
                        undoMove();
                        return beta;
                    }
                    if (score > alpha)
                        alpha = score;
                }
                else {
                    score = evaluate();
                    nodes ++;
                }
            }

            if (score > best)
                best = score;

            undoMove();
            if (idepth >= 3 && score > 20000)
                break;
        }

        // checkmate?
        if (!valid && kingAttacked(2))
            best = -51200 + idepth * 4000;
        else
            best += valid * 0.2;
        return best;
    }

    /**
     * Convert a square number to an algebraic notation
     * - 'a' = 97
     * - '8' = 56
     * @param square 112
     * @param check check the boundaries
     * @return a1
     */
    std::string squareToAn(int square, bool check) {
        int file = FILE(square),
            rank = RANK(square);
        if (check && (file < 0 || file > 7 || rank < 0 || rank > 7))
            return "";
        std::string text;
        text += ('a' + file);
        text += ('8' - rank);
        return text;
    }

    /**
     * Add UCI to a move
     * @param {Move} move
     * @returns {string}
     */
    std::string ucify(Move &move) {
        move.m = squareToAn(move.from, false) + squareToAn(move.to, false);
        if (move.promote)
            move.m += PIECE_LOWER[move.promote];
        return move.m;
    }

    /**
     * Undo a move
     */
    void undoMove() {
        if (ply < 0)
            return;

        auto &state = ply_states[ply];
        memcpy(castling, state.castling, sizeof(castling));
        ep_square = state.ep_square;
        half_moves = state.half_moves;
        memcpy(kings, state.kings, sizeof(kings));
        Move &move = state.move;

        turn ^= 1;
        if (turn == BLACK)
            move_number --;
        ply --;

        uint8_t us = turn,
            them = turn ^ 1;

        // undo castle
        if (move.flags & BITS_CASTLE) {
            int q = (move.flags & BITS_QSIDE_CASTLE)? 1: 0,
                king = kings[us],
                king_to = (RANK(king) << 4) + 6 - (q << 2),
                rook = castling[(us << 1) + q];

            board[king_to] = 0;
            board[king_to - 1 + (q << 1)] = 0;
            board[king] = COLORIZE(us, KING);
            board[rook] = COLORIZE(us, ROOK);
        }
        else {
            if (move.from != move.to) {
                board[move.from] = move.piece;
                board[move.to] = 0;
            }

            if (move.flags & BITS_CAPTURE) {
                board[move.to] = COLORIZE(them, move.capture);
                materials[them] += PIECE_SCORES[move.capture];
            }
            else if (move.flags & BITS_EP_CAPTURE) {
                board[move.to + 16 - (us << 5)] = COLORIZE(them, PAWN);
                materials[them] += PIECE_SCORES[PAWN];
            }
            if (move.promote)
                materials[us] -= PROMOTE_SCORES[move.promote];
        }
    }

    // EMSCRIPTEN INTERFACES
    ////////////////////////

    int em_avgDepth() {
        return avg_depth;
    }

    val em_board() {
        return val(typed_memory_view(128, board));
    }

    val em_castling() {
        return val(typed_memory_view(4, castling));
    }

    bool em_checked(uint8_t color) {
        return kingAttacked(color);
    }

    std::string em_fen() {
        return fen;
    }

    bool em_frc() {
        return frc;
    }

    int em_material(uint8_t color) {
        return materials[color];
    }

    val em_mobilities() {
        countMobilities();
        return val(typed_memory_view(16, mobilities));
    }

    int em_nodes() {
        return nodes;
    }

    uint8_t em_piece(std::string text) {
        if (text.size() != 1)
            return 0;
        auto it = PIECES.find(text.at(0));
        return (it != PIECES.end())? it->second: 0;
    }

    int em_selDepth() {
        return sel_depth;
    }

    uint8_t em_turn() {
        return turn;
    }

    std::string em_version() {
        return "20200915";
    }
};

// BINDING CODE
///////////////

EMSCRIPTEN_BINDINGS(chess) {
    // MOVE BINDINGS
    value_object<Move>("Move")
        .field("capture", &Move::capture)
        .field("flags", &Move::flags)
        .field("from", &Move::from)
        .field("m", &MoveText::m)
        .field("piece", &Move::piece)
        .field("promote", &Move::promote)
        .field("to", &Move::to)
        ;

    value_object<MoveText>("MoveText")
        .field("capture", &MoveText::capture)
        .field("flags", &MoveText::flags)
        .field("from", &MoveText::from)
        .field("m", &MoveText::m)
        .field("piece", &MoveText::piece)
        .field("promote", &MoveText::promote)
        .field("to", &MoveText::to)
        //
        .field("fen", &MoveText::fen)
        .field("ply", &MoveText::ply)
        .field("score", &MoveText::score)
        ;

    // CHESS BINDINGS
    class_<Chess>("Chess")
        .constructor()
        //
        .function("anToSquare", &Chess::anToSquare)
        .function("attacked", &Chess::attacked)
        .function("avgDepth", &Chess::em_avgDepth)
        .function("board", &Chess::em_board)
        .function("castling", &Chess::em_castling)
        .function("checked", &Chess::em_checked)
        .function("cleanSan", &Chess::cleanSan)
        .function("clear", &Chess::clear)
        .function("configure", &Chess::configure)
        .function("currentFen", &Chess::em_fen)
        .function("decorate", &Chess::decorateMove)
        .function("fen", &Chess::createFen)
        .function("frc", &Chess::em_frc)
        .function("fen960", &Chess::createFen960)
        .function("load", &Chess::load)
        .function("material", &Chess::em_material)
        .function("mobilities", &Chess::em_mobilities)
        .function("moveObject", &Chess::moveObject)
        .function("moveRaw", &Chess::moveRaw)
        .function("moveSan", &Chess::moveSan)
        .function("moveToSan", &Chess::moveToSan)
        .function("moveUci", &Chess::moveUci)
        .function("moves", &Chess::createMoves)
        .function("multiSan", &Chess::multiSan)
        .function("multiUci", &Chess::multiUci)
        .function("nodes", &Chess::em_nodes)
        .function("order", &Chess::orderMoves)
        .function("params", &Chess::params)
        .function("piece", &Chess::em_piece)
        .function("print", &Chess::print)
        .function("put", &Chess::put)
        .function("reset", &Chess::reset)
        .function("sanToMove", &Chess::sanToMove)
        .function("search", &Chess::search)
        .function("selDepth", &Chess::em_selDepth)
        .function("squareToAn", &Chess::squareToAn)
        .function("turn", &Chess::em_turn)
        .function("ucify", &Chess::ucify)
        .function("undo", &Chess::undoMove)
        .function("version", &Chess::em_version)
        ;

    register_vector<int>("vector<int>");
    register_vector<Move>("vector<Move>");
    register_vector<MoveText>("vector<MoveText>");
}
