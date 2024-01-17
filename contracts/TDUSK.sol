// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TDUSK is ERC20 {
    constructor() ERC20("tDUSK", "TDUSK") {
        _mint(msg.sender, 500000000 * 10 ** decimals());
    }
}