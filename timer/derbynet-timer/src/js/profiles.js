'use strict';

// The timers DerbyNet can talk to, one entry per model: its serial settings,
// how to recognize it, the commands that set it up for a heat, and the
// patterns that pick lane times and gate state out of what it sends.  This is
// data, not code; prober.js and timer_proxy.js read it.  The fields are
// described in this directory's README.
//
// Edit this file to add or change a timer.  (It used to be generated from
// upstream DerbyNet's Java timer; the notes above each entry came from there.)
//
// The FastTrack K/Q entry always sends N2 (enhanced format) in its set-up; an
// old timer that doesn't support it would need an entry without it.

var _all_the_timer_profiles = [
  // Pre-probe lets the timer settle
  // January, 2023: New "Champ" timer responds with
  // Rev H Copyright SRM Enterprises
  // (not even a valid copyright)
  // "r": RESET
  // The ox0 appears to cause the timer to stop responding for a
  // second or two, ignoring at least all the commands that follow
  // in this set-up.
  // "ox0",  Set Champ Timer mode instead of DTX
  // Interrogate for a bunch of details here
  // "or": read auto-reset delay
  // "ol": read lane character
  // "od": read decimal places
  // "op": read place character
  // "rs": read start switch
  // Set to known state
  // "ol0": report lane 1 as "A"
  // "op3": set place character '!'
  // "rs": READ_START_SWITCH
  // rg = "Return results when race ends"
  // Any gate polling sent after this apparently causes the 'rg' to be
  // canceled.  Also, Pack936 reported an issue with the 'rg' being sent
  // too quickly after gate opening, causing the previous heat's results
  // to be sent again.
  // ra = "Force end of race, return results, then reset"
  {
    "name": "\"The Champ\" (SmartLine/BestTrack)",
    "key": "TheChamp",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 6,
      "eol": "\r",
      "gate_state_is_knowable": true,
      "timer_scale_factor": 1
    },
    "prober": {
      "responses": [
        "eTekGadget SmartLine Timer"
      ],
      "pre_probe": {
        "commands": [
          ""
        ]
      },
      "probe": "v"
    },
    "setup": {
      "commands": [
        "r",
        "or",
        "ol",
        "od",
        "op",
        "rs",
        "ol0",
        "op3"
      ]
    },
    "setup_queries": [
      {
        "matchers": [
          {
            "args": [
              1
            ],
            "pattern": "^(\\d)$",
            "event": "LANE_COUNT"
          }
        ],
        "command": "on"
      }
    ],
    "matchers": [
      {
        "args": [
          1,
          2
        ],
        "pattern": " *([A-Z])=(\\d\\.\\d+)([^ ]?)",
        "event": "LANE_RESULT"
      }
    ],
    "heat_prep": {
      "reset": "rg",
      "unmask": "om0",
      "lane": "1",
      "mask": "om"
    },
    "gate_watcher": {
      "matchers": [
        {
          "pattern": "^0$",
          "event": "GATE_CLOSED"
        },
        {
          "pattern": "^1$",
          "event": "GATE_OPEN"
        }
      ],
      "command": "rs"
    },
    "on": {
      "RACE_STARTED": {
        "commands": [
          "rg"
        ]
      },
      "OVERDUE": {
        "commands": [
          "ra"
        ]
      }
    }
  },

  // January, 2023: New "Champ" timer responds to a "v" with:
  // Rev H Copyright SRM Enterprises
  // (not even a valid copyright)
  // Pre-probe lets the timer settle
  // This firmware responds "?" to each one-letter command EXCEPT:
  // "A", "C" (gives gate state as 0 or 1), "D", "F", "R", and "v" (not "V")
  // The original Champ timer can report lanes with letters or numbers.
  // This firmware reports with numbers by default, and we haven't figured
  // out if it's configurable.
  {
    "name": "\"The Champ\" (SRM)",
    "key": "TheChampSRM",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 6,
      "eol": "\r",
      "gate_state_is_knowable": false,
      "timer_scale_factor": 1
    },
    "prober": {
      "responses": [
        "SRM.*Enterprises"
      ],
      "pre_probe": {
        "commands": [
          ""
        ]
      },
      "probe": "v"
    },
    "matchers": [
      {
        "pattern": "S",
        "event": "RACE_STARTED"
      },
      {
        "args": [
          1,
          2
        ],
        "pattern": " *(\\d)=(\\d\\.\\d+)([^ ]?)",
        "event": "LANE_RESULT"
      }
    ]
  },

  // From the Micro Wizard himself:
  //
  // MicroWizard FastTrack commands (from upstream's MicroWizard.java):
  //   LG  pulse the laser bit: starts the timer after a brief pause, and
  //       triggers the automatic gate release, if installed
  //   LR  reset the laser gate; the real "reset" command for the timer
  //   M + A..F   mask out a lane (MA = lane 1, ...);  MG clears the mask
  //   N0  old format:  A=3.001! B=3.002 C=3.003 D=3.004 E=3.005 F=3.006 <LF><CR>
  //   N1  new format:  A=3.001! B=3.002" C=3.003# D=3.004$ E=3.005% F=3.006& <CR><LF>
  //   N2  enhanced format: 5-digit times and start switch status (2012 and
  //       newer timers only)
  //   RA  force results; reports nothing unless a car has crossed the line,
  //       but stops the timer
  //   RE  reset eliminator mode
  //   RF  return features (see below);  RG  read start switch;  RL + 0-6
  //       reverse lanes;  RM read mode;  RS read serial number;  RV read
  //       version
  //   A K1 timer from 2004 (version 1.09D) reported RF as 0011 1111, and "X"
  //   (not available) for RG.  Replies may start with '@' or '>', which are
  //   ignored.
  //
  // The FastTrack timer has 1 pin, 1 bit that is the laser gate bit.  This is
  // connected to a pin on the RJ-11 cable that goes to the start.
  //
  // Our automatic release gate uses the same cable and so these commands can interact
  // with that gate as well.  However it uses the laser bit in a different way than the
  // laser gate.
  //
  // LO - Sets that bit low
  // LN - Sets that bit high
  // LG - Sets high for 1 second, then low
  // LR - Sets high until the switch is released, then low  (RESET_LASER_GATE)
  //
  // When our automatic release gate is connected the laser gate bit is now used as a
  // command to release the cars.  So when you send the LR command the start gate will
  // begin its sequence to release the cars.
  //
  // The preferred command for releasing the automatic release gate is with the LG
  // command, although LR could work as could LN.  All the commands were put in here so
  // that people could make their own release gates and software and make it work with
  // our cable.
  // Copyright (c) Micro Wizard 2002-2005
  // K3 Version 1.05A  Serial Number <nnnnn>
  //
  // Copyright (C) 2004 Micro Wizard
  // K1 Version 1.09D Serial Number <nnnnn>
  //
  // COPYRIGHT (c) MICRO WIZARD 2002
  // K2 Version 1.05a  Serial Number <nnnnn>
  // RE: Reset eliminator mode
  // N1: "new" format
  // N2: enhanced format
  // Q1 timer also supports an "N3" mode, which allows times longer
  // than 10 seconds.
  // RF: return features
  //   8th bit Sequence of Finish K3 only
  //   7th bit Countdown Clock
  //   6th bit Laser Reset from computer
  //   5th bit Force End the race and send results
  //   4th bit Eliminator mode
  //   3rd bit Reverse Lanes
  //   2nd bit Mask Lanes
  //   1st bit Serial race data option
  // "RG": Read start switch condition
  // An "X" after RG means option disabled
  {
    "name": "FastTrack K- or Q-series",
    "key": "FastTrack-K",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 6,
      "eol": "",
      "gate_state_is_knowable": true,
      "timer_scale_factor": 1
    },
    "prober": {
      "responses": [
        "Micro Wizard|MICRO WIZARD",
        "^K|Model: Q"
      ],
      "probe": "RV"
    },
    "setup": {
      "commands": [
        "RE",
        "N1",
        "N2"
      ]
    },
    "setup_queries": [
      {
        "matchers": [
          {
            "pattern": "^[01][01]0[01] *[01][01][01]1$",
            "event": "FASTTRACK_NO_LASER_RESET"
          }
        ],
        "command": "RF"
      }
    ],
    "matchers": [
      {
        "args": [
          1,
          2
        ],
        "pattern": " *([A-Z])=(\\d+\\.\\d+)([^ ]?)",
        "event": "LANE_RESULT"
      }
    ],
    "heat_prep": {
      "unmask": "MG",
      "lane": "A",
      "mask": "M"
    },
    "gate_watcher": {
      "matchers": [
        {
          "pattern": "^RG0|0$",
          "event": "GATE_OPEN"
        },
        {
          "pattern": "^RG1|1$",
          "event": "GATE_CLOSED"
        },
        {
          "pattern": "^X$",
          "event": "GATE_WATCHER_NOT_SUPPORTED"
        }
      ],
      "command": "RG"
    },
    "poll": {
      "MARK": {
        "condition": "fasttrack_poll_mark",
        "commands": {
          "commands": [
            "LR"
          ]
        }
      }
    },
    "remote_start": {
      "has_remote_start": "fasttrack_has_automatic_gate_release",
      "command": "LG"
    }
  },

  {
    "name": "FastTrack P-series",
    "key": "FastTrack-P",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 6,
      "eol": "",
      "gate_state_is_knowable": false,
      "timer_scale_factor": 1
    },
    "setup": {
      "commands": [
        "RF"
      ]
    },
    "matchers": [
      {
        "args": [
          1,
          2
        ],
        "pattern": " *([A-Z])=(\\d\\.\\d+)([^ ]?)",
        "event": "LANE_RESULT"
      }
    ]
  },

  // No set-up commands
  // DNFs get reported as e.g.
  // +23:23:27.919S     <-- Lane 6     31.0589   DNF
  // i.e., they have a time just like every other lane, reported just before
  // the Race Over message.
  // "Race Over" seems to be redundant -- DNFs get reported as lane results,
  // and the last lane result will trigger a RACE_FINISHED event.
  // Since gate state is not knowable, gate_watcher doesn't run, so this
  // shouldn't make any difference.  It's not even clear the timer supports
  // this command.
  // "rs": READ_START_SWITCH
  {
    "name": "The Judge (New Directions)",
    "key": "TheJudge",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 0,
      "eol": "\r",
      "gate_state_is_knowable": false,
      "timer_scale_factor": 1
    },
    "prober": {
      "responses": [
        "Checking Valid Lanes"
      ],
      "probe": "*"
    },
    "setup": {
      "commands": []
    },
    "matchers": [
      {
        "args": [
          1
        ],
        "pattern": "Number of Lanes:?\\s+(\\d)",
        "event": "LANE_COUNT"
      },
      {
        "pattern": "^G[oO]!?$",
        "event": "RACE_STARTED"
      },
      {
        "args": [
          1,
          2
        ],
        "pattern": "^Lane\\s+(\\d)\\s+0*(\\d+\\.\\d+)(\\s.*)?$",
        "event": "LANE_RESULT"
      },
      {
        "pattern": "Race Over.*",
        "event": "RACE_FINISHED"
      }
    ],
    "heat_prep": {
      "unmask": "om0",
      "lane": "1",
      "mask": "om"
    },
    "gate_watcher": {
      "matchers": [],
      "command": "rs"
    },
    "on": {
      "OVERDUE": {
        "commands": [
          "*"
        ]
      }
    }
  },

  {
    "name": "NewBold DT, TURBO, or DerbyStick",
    "key": "NewBold",
    "params": {
      "baud": 1200,
      "data": 7,
      "stop": 2,
      "parity": 0
    },
    "options": {
      "max_lanes": 0,
      "eol": "",
      "gate_state_is_knowable": false,
      "timer_scale_factor": 1
    },
    "setup": {
      "commands": [
        " "
      ]
    },
    "matchers": [
      {
        "args": [
          1,
          2
        ],
        "pattern": "^\\s*(\\d)\\s+(\\d\\.\\d+)(\\s|)",
        "event": "LANE_RESULT"
      }
    ],
    "heat_prep": {
      "reset": " "
    }
  },

  // This class supports the "Derby Timer" device, http://derbytimer.com
  // .match("^FINISH$", Event.RACE_FINISHED)
  // TimerDeviceUtils.zeroesToNines(results)
  {
    "name": "Derby Timer",
    "key": "DerbyTimer.com",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 0,
      "eol": "",
      "gate_state_is_knowable": true,
      "timer_scale_factor": 1
    },
    "prober": {
      "responses": [
        "^RESET$",
        "^READY\\s*(\\d+)\\s+LANES"
      ],
      "probe": "R"
    },
    "matchers": [
      {
        "args": [
          1
        ],
        "pattern": "^READY\\s*(\\d+)\\s+LANES",
        "event": "LANE_COUNT"
      },
      {
        "args": [
          1,
          2
        ],
        "pattern": "^\\s*(\\d)\\s+(\\d\\.\\d+)(\\s.*|)",
        "event": "LANE_RESULT"
      },
      {
        "pattern": "^RACE$",
        "event": "RACE_STARTED"
      }
    ],
    "heat_prep": {
      "unmask": "C",
      "lane": "1",
      "mask": "M"
    },
    "gate_watcher": {
      "matchers": [
        {
          "pattern": "^U$",
          "event": "GATE_CLOSED"
        },
        {
          "pattern": "^D$",
          "event": "GATE_OPEN"
        }
      ],
      "command": "G"
    },
    "on": {
      "OVERDUE": {
        "commands": [
          "F"
        ]
      }
    }
  },

  // TODO remote start "S"
  // "N": followed by numl="
  // .match("^K$"  )  // ready for next race?
  // The Reset command needs to be sent after the gate is closed.
  {
    "name": "PDT timer (https://www.dfgtec.com/pdt)",
    "key": "MiscJunk",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 0,
      "eol": "",
      "gate_state_is_knowable": true,
      "timer_scale_factor": 1
    },
    "prober": {
      "responses": [
        "vert="
      ],
      "pre_probe": {
        "commands": [
          ""
        ]
      },
      "probe": "V"
    },
    "setup": {
      "commands": [
        "R",
        "N"
      ]
    },
    "matchers": [
      {
        "args": [
          1
        ],
        "pattern": "numl=(\\d)",
        "event": "LANE_COUNT"
      },
      {
        "pattern": "^B$",
        "event": "RACE_STARTED"
      },
      {
        "args": [
          1,
          2
        ],
        "pattern": "(\\d) - (\\d+\\.\\d+)",
        "event": "LANE_RESULT"
      }
    ],
    "heat_prep": {
      "reset": "R",
      "unmask": "U",
      "lane": "1",
      "mask": "M"
    },
    "gate_watcher": {
      "matchers": [
        {
          "pattern": "O",
          "event": "GATE_OPEN"
        },
        {
          "pattern": "\\.",
          "event": "GATE_CLOSED"
        }
      ],
      "command": "G"
    },
    "on": {
      "GET_SET": {
        "commands": [
          "R"
        ]
      },
      "OVERDUE": {
        "commands": [
          "F"
        ]
      }
    },
    "remote_start": {
      "command": "S"
    }
  },

  // http://www.derbymagic.com/files/Timer.pdf
  // http://www.derbymagic.com/files/GPRM.pdf
  {
    "name": "Derby Magic timer",
    "key": "DerbyMagic",
    "params": {
      "baud": 19200,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 8,
      "eol": "",
      "gate_state_is_knowable": false,
      "timer_scale_factor": 1
    },
    "prober": {
      "responses": [
        "Derby Magic"
      ],
      "probe": "V"
    },
    "setup": {
      "commands": [
        "R"
      ]
    },
    "matchers": [
      {
        "pattern": "^B$",
        "event": "RACE_STARTED"
      },
      {
        "args": [
          1,
          2,
          3
        ],
        "pattern": "([1-8])=(\\d\\.\\d+)([!-/:-@])? *",
        "event": "LANE_RESULT"
      }
    ],
    "remote_start": {
      "command": "S"
    }
  },

  {
    "name": "Derby Magic timer (9600)",
    "key": "DerbyMagic9600",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 8,
      "eol": "",
      "gate_state_is_knowable": false,
      "timer_scale_factor": 1
    },
    "prober": {
      "responses": [
        "Derby Magic"
      ],
      "probe": "V"
    },
    "setup": {
      "commands": [
        "R"
      ]
    },
    "matchers": [
      {
        "pattern": "^B$",
        "event": "RACE_STARTED"
      },
      {
        "args": [
          1,
          2,
          3
        ],
        "pattern": "([1-8])=(\\d\\.\\d+)([!-/:-@])? *",
        "event": "LANE_RESULT"
      }
    ],
    "remote_start": {
      "command": "S"
    }
  },

  // This class supports PICmicro-based DIY timer designed by Bert Drake,
  // described at http://drakedev.com/pinewood/.  The "Race Timer Software
  // Interface Protocol" is described at
  // http://drakedev.com/pinewood/protocol.html
  // TimerDeviceUtils.zeroesToNines(results)
  // "F": TODO: , "T"
  {
    "name": "Bert Drake timer",
    "key": "BertDrake",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 0,
      "eol": "",
      "gate_state_is_knowable": true,
      "timer_scale_factor": 1
    },
    "prober": {
      "responses": [
        "Bert Drake"
      ],
      "pre_probe": {
        "commands": [
          "R"
        ]
      },
      "probe": "V"
    },
    "matchers": [
      {
        "pattern": "^B$",
        "event": "GATE_OPEN"
      },
      {
        "args": [
          1,
          2
        ],
        "pattern": "^\\s*(\\d)\\s+(\\d\\.\\d+)(\\s.*|)",
        "event": "LANE_RESULT"
      }
    ],
    "heat_prep": {
      "reset": "R"
    },
    "gate_watcher": {
      "matchers": [
        {
          "pattern": "^Gc$",
          "event": "GATE_CLOSED"
        },
        {
          "pattern": "^Go$",
          "event": "GATE_OPEN"
        }
      ],
      "command": "C"
    },
    "on": {
      "OVERDUE": {
        "commands": [
          "F"
        ]
      }
    }
  },

  // TODO filter escape characters from timer identifier string
  {
    "name": "JIT Racemaster",
    "key": "JIT",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 0,
      "eol": "",
      "gate_state_is_knowable": false,
      "timer_scale_factor": 1
    },
    "prober": {
      "responses": [
        "JIT, Inc.*Racemaster Software",
        "^Software Version"
      ],
      "probe": "V"
    },
    "setup": {
      "commands": [
        "L"
      ]
    },
    "matchers": [
      {
        "args": [
          1,
          2
        ],
        "pattern": "^.*Place Single Lane Number:\\s*(\\d+)\\s+Time in Seconds:\\s*(\\d+\\.\\d{4,})",
        "event": "LANE_RESULT"
      }
    ],
    "heat_prep": {
      "reset": "R"
    }
  },

  // SuperTimer II Overview
  //
  // The SuperTimer doesn't report a gate state or race started condition.
  // The SuperTimer race operates as follows:
  // - Send Masking command (no response from track)
  // - With Masking command, send the timeout if needed (How long track waits
  //  before reporting results after the gate opens)
  // - Run the race on the track by triggering the safety (track start), then the
  //  start button at the track end.
  // - The track will timeout after the timeout seconds (I believe default is 10s)
  // - Once timed out or all lanes have a time, the results are sent to the timer.
  //  The results are returned in finish order, reporting only lanes that finished.
  //  Example result for 4 lanes with a DNF:
  //      +20:28:05.495S        <-- #1
  //      +20:28:05.532S        <-- 19491
  //      +20:28:05.572S        <-- #3
  //      +20:28:05.609S        <-- 20376
  //      +20:28:05.536S        <-- #2
  //      +20:28:05.572S        <-- 27563
  //      +20:28:05.656S        <-- !
  //    These times represent Lane 1: 1.9491s, Lane 2: 2.7563s,
  //    Lane 3: 2.0376s, Lane 4: DNF
  //
  //  To handle this, times are submitted in parts, PARTIAL_LANE_RESULT_LANE_NUM,
  //  then PARTIAL_LANE_RESULT_TIME (time gets the decimal inserted), then
  //  NO_MORE_RESULTS is submitted on the "!" to tell the timer software that any 
  //  un-reported lanes are to be marked as a DNF.
  //  The NO_MORE_RESULTS will fill in all times Aas DNF, triggering the 
  //  RACE_FINISHED event internally and posting the times.
  // ----------------------------------------------
  // Unimplemented handling/commands
  // ----------------------------------------------
  // Pause heat: 3@7A\r
  // Track timeout handling
  // Timeout -- GET
  //     This command requests the timeout info from the track. It would be nice to update the
  //     value in the web UI to show that.
  //     00\r (0x30 0x30 0x0d) is request track info/timeout. Char 2 of the return is the timeout
  //        \/--- Timeout char
  //     4a 7c 7f 42 43 41 45  J|BCAE // 15s timeout
  //     4a 70 7f 42 43 41 45  JpBCAE // 12s timeout
  // .setup("3O5A\r3O5A")
  // SuperTimer accepts the lane mask as a single command string, rather than
  // separate commands for each masked lane.  OneCommandMask is an alternative
  // to the unmask/mask/lane triple found in the HeatPreparation struct.
  //
  // 3A5A\r Lane 1 enabled       Binary: 000001
  // 3C5A\r Lanes 1-2 enabled    Binary: 000011
  // 3G5A\r Lanes 1-3 enabled    Binary: 000111
  // 3O5A\r Lanes 1-4 enabled    Binary: 001111
  // 3_5A\r Lanes 1-5 enabled    Binary: 011111
  // 3\5A\r Lanes 3, 4, 5, 6     Binary: 111100
  // "3@5A" as an int:
  // Timeout -- SET
  //     Set timeout command
  //         HEX = 32 <@/0x40 + (4*num sec)> 0d
  //         DEC = 2 <64 + 4 * num sec> \r
  //     Example command and responses:
  //     cmd (hex) (ascii) Timeout
  //     32 a4 0d    2¤.    25
  //     32 a0 0d    2 .    24
  //     32 3f 0d    2?.    21-23 // Not sure why these repeat
  //     32 90 0d    2.    20
  //     32 3f 0d    2?.    16-19 // Not sure why these repeat
  //     32 7c 0d    2|.    15
  //     32 78 0d    2x.    14
  //     32 74 0d    2t.    13
  //     32 70 0d    2p.    12
  //     32 6c 0d    2l.    11
  //     32 68 0d    2h.    10
  //     32 40 0d    2@.    NO Timeout
  // ----------------------------------------------
  // ////////////////////////
  // TODO .set_heat_timeout_duration_command(new EmbeddedFieldCommand(0x3240, 2, 2))
  // Additional insights reported by jeffmahoney in
  // https://github.com/jeffpiazza/derbynet/pull/386:
  //
  // The SuperTimer II has an undocumented protocol which the manufacturer
  // refuses to support outside of their own (very) outdated software.
  //
  // Here's what I've been able to gather from sniffing the serial line.
  // Commands from the host are completed with a CR ('\r').  Responses
  // from the timer may be completed with a CR.  Some are not.
  //
  // Initial detection:
  // Host sends "UUUUc\r"
  // Timer returns "UUUUt\r"
  //
  // Audio test;
  //   To perform an audio test where the timer will go through all of
  //   the announcements, send the command: "6\xa4\r"
  //
  // Configuration Query:
  // Host sends "00\r" (two zeroes)
  // Timer returns 6 characters, which do -not- include a \r.
  // 0: Tiebreaker Margin
  // 1: Timeout
  // 2: Lane Mask
  // 3: Announcement Style
  // 4: Unknown
  // 5: Unknown
  // 6: Unknown
  // Note: This may also function as a reset of sorts.  The Windows software
  // did it periodically.
  //
  // There are several classes of configuration, each prefixed with a digit.
  // Tiebreaker margin.
  //    If two cars finish within this margin, it is considered a tie.
  //    The available offsets are from 0-2.0ms in 0.1ms increments.
  //    The values start at 0x40 to indicate 0 and end at 0x54 to indicate
  //    2.0ms.  These values are represented in ASCII: @ through T.
  // Timeout select.
  //    If a car doesn't finish before the amount of time specified, a 10.000
  //    values is returned for that lane and the race is over.  The available
  //    options are from 0 (disabled) to 60 seconds.  0-47 seconds can be
  //    specified individually with binary values starting at 0x40 and
  //    incrementing 4 at a time until 47 is specified with 0xf4.  0 seconds
  //    is specified with 0x40 (@), 1 second is specified with 0x44 (D).
  //    10 seconds, which we use above, is 0x68 (h).  Starting with 48
  //    seconds, it gets strange and I'm uncertain if some of these values
  //    are bugs in the original software or if the protocol really does this.
  //    I haven't tested to see what timeout is actually used when there is
  //    a conflict.
  //    48 -> \x41 (A)
  //    49 -> \x41 (A)
  //    50 -> \x43 (C)
  //    51 -> \x43 (C)
  //    52 -> \xd0   -- This conflicts with 36 seconds
  //    53 -> \x45 (E)
  //    54 -> \x45 (E)
  //    55 -> \x47 (G)
  //    56 -> \x47 (G)
  //    57 -> \x48 (H) -- This conflicts with 2 seconds
  //    58 -> \x49 (I)
  //    59 -> \x49 (I)
  //    60 -> \x49 (I)
  // Lane mask.
  //    The SuperTimer II supports up to 6 lanes.
  //    The value used is a 6 bit bitmask.  The timer itself is unaware
  //    of how many lanes are attached.  It is just instructed to monitor
  //    lanes.  If this is misconfigured, timeouts will always be triggered.
  //    The bitmask is offset by 0x40, so that an empty mask is @.
  //    For a 6 lane track: 0b111111 -> 'O'
  //    For a 4 lane track: 0b001111 -> 'O'
  //    For a 2 lane track: 0b000011 -> '\x7f'
  //    The bitmask can be sparse as well, so a 6 lane track using every
  //    other lane would be: 0b010101 -> 'U'
  // Announcement mode.
  //    The timer has audio output that can announce the results of the race
  //    independently of this software.
  //    There are 5 modes:
  //    @ - No announcements
  //    A - Lanes in finish order only
  //    B - Lanes in finish order and winner time
  //    C - Lanes in finish order including all times
  //    D - Lanes in finish order including time differences
  //
  // Changing configuration.  Each configuration type uses a digit prefix
  //
  // Tiebreaker margin.
  //    Using the values above,
  //    To set configuration, prefix '1'
  //    1<char>\r
  {
    "name": "Super Timer II",
    "key": "Super Timer II",
    "params": {
      "baud": 9600,
      "data": 8,
      "stop": 1,
      "parity": 0
    },
    "options": {
      "max_lanes": 6,
      "eol": "\r",
      "gate_state_is_knowable": false,
      "timer_scale_factor": 10000
    },
    "prober": {
      "responses": [
        "UUUUt"
      ],
      "probe": "UUUUc"
    },
    "matchers": [
      {
        "args": [
          1
        ],
        "pattern": "#([1-6])",
        "event": "PARTIAL_LANE_RESULT_LANE_NUM"
      },
      {
        "args": [
          0
        ],
        "pattern": "(\\d{4,})",
        "event": "PARTIAL_LANE_RESULT_TIME"
      },
      {
        "pattern": "!",
        "event": "RACE_FINISHED"
      }
    ],
    "heat_prep": {
      "embedded_mask_command": {
        "offset": 16,
        "command": 859845953,
        "nbytes": 4
      }
    }
  }
];

function all_profiles() {
  return _all_the_timer_profiles;
}
