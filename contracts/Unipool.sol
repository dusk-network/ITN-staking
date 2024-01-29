// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LPTokenWrapper {
    using SafeERC20 for IERC20;

    IERC20 public dusk;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    constructor(IERC20 _dusk) {
        dusk = _dusk;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function stake(uint256 amount, string calldata duskAddress) public virtual {
        _totalSupply += amount;
        _balances[msg.sender] += amount;
        dusk.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public virtual {
        _totalSupply -= amount;
        _balances[msg.sender] -= amount;
        dusk.safeTransfer(msg.sender, amount);
    }
}

contract Unipool is LPTokenWrapper {
    using SafeERC20 for IERC20;

    bool public stakingPeriodInitialized = false;

    address public owner;
    uint256 public constant DURATION = 43 days;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event StakingPeriodInitialized();
    event Staked(address indexed user, uint256 amount, string duskAddress);
    event Withdrawn(address indexed user, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    constructor(IERC20 _dusk) LPTokenWrapper(_dusk) {
        owner = msg.sender;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            ((lastTimeRewardApplicable() - lastUpdateTime) *
                rewardRate *
                1e18) /
            totalSupply();
    }

    function earned(address account) public view returns (uint256) {
        return
            ((balanceOf(account) *
                (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18) +
            rewards[account];
    }

    // stake visibility is public as overriding LPTokenWrapper's stake() function
    function stake(
        uint256 amount,
        string calldata duskAddress
    ) public override updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        super.stake(amount, duskAddress);
        emit Staked(msg.sender, amount, duskAddress);
    }

    function withdraw(uint256 amount) public override updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        super.withdraw(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function initializeStakingPeriod() external onlyOwner {
        require(!stakingPeriodInitialized, "Staking already initialized");

        uint256 fixedReward = 2_500_000 * 1e18;

        rewardRate = fixedReward / DURATION;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + DURATION;

        stakingPeriodInitialized = true;

        emit StakingPeriodInitialized();
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
