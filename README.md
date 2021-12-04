# Open BCI Web GUI

### by Michael Elia

## Requirements

- The program must be run on a Windows computer. Linux and Mac are untested. Safari will not work because it does not allow unsecure websockets.
- It is NOT required to install nodejs beforehand. 
- It is recommended that a web browser be installed on the computer, preferably chrome. Other browsers not tested.
- Only Cyton boards will work - though the program can be used without a board.

## Installation

1. Download the open_bci_web_gui.zip file from the [Releases](https://github.com/MJE10/open_bci_web_gui/releases) page.
2. Extract the zip.

## Usage

- To start the program, run the start.bat file and open up a web browser to [localhost:3000](http://localhost:3000).

- The indicators in the top left show whether the browser has succesfully connected to the program, and whether the program has successfully connected to the board.
- The table in the center shows information about each channel and options that can be changed per channel.
- The settings pannel shows items that apply globally.

- Any of the three panels can be toggled with the buttons in the top row.

- The background of the slider in the Threshold section shows the current level of input. Use the + and - buttons to increase and decrease the scale, especially if the input exceeds the width of the slider.
- Click anywhere on a slider to set a threshold. When the input exceeds this threshold, the action will be completed.
- In "average" mode, the input will be the absolute average of the last x samples, where x is determined by the Threshold Parameter.
- In "max" mode, the input will be the absolute maximum of the last x samples, where x is determined by the Threshold Parameter.
- In "last" mode, the input will be the most recent sample.
- The action column allows you to select which key is pressed (simulated keyboard input) when the input exceeds the threshold.
- The action type column allows you to select whether the key is toggled, tapped, or feathered.
- In "toggle" mode, the keyDown event will fire when the threshold is exceeded, and the keyUp event will fire when the input falls back below the threshold.
- In "tap" mode, the keyPress event will fire when the threshold is exceeded.
- In "feather" mode, the keyPress event will fire several times per second while the input is greater than the threshold.

- "Advanced" mode will toggle numeric data for each channel.
- If "Allow Simulator" is checked, the program will use simulated OpenBCI data in the absence of a Cyton board.
- The Reconnect button will destroy the existing board connection and attempt to reconnect to the board or, if allowed, the simulator.
