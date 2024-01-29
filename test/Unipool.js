const { expect } = require("chai");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Unipool", function () {
    async function deployUnipoolFixture() {
        const [owner, addr1, addr2] = await ethers.getSigners();
        const TDUSK = await ethers.getContractFactory("TDUSK");
        const tdusk = await TDUSK.deploy();

        const Unipool = await ethers.getContractFactory("Unipool");
        const unipool = await Unipool.deploy(await tdusk.getAddress());

        // Set up initial token balances for testing
        const stakeAmount = hre.ethers.parseEther("100");
        await tdusk.transfer(addr1.address, stakeAmount);
        await tdusk.transfer(addr2.address, stakeAmount);

        // Approve Unipool contract to spend tokens
        await tdusk.connect(addr1).approve(await unipool.getAddress(), stakeAmount);
        await tdusk.connect(addr2).approve(await unipool.getAddress(), stakeAmount);

        return { unipool, tdusk, owner, addr1, addr2, stakeAmount };
    }

    describe("Staking", function () {
        it("should allow users to stake tokens", async function () {
            const { unipool, tdusk, addr1, addr2, stakeAmount } = await loadFixture(deployUnipoolFixture);

            expect(await unipool.balanceOf(addr1.address)).to.equal(0);
            expect(await unipool.balanceOf(addr2.address)).to.equal(0);
            expect(await unipool.totalSupply()).to.equal(0);
            expect(await tdusk.balanceOf(await unipool.getAddress())).to.equal(0);

            await expect(unipool.connect(addr1).stake(stakeAmount, ""))
                .to.emit(unipool, "Staked")
                .withArgs(addr1.address, stakeAmount, "");

            expect(await unipool.totalSupply()).to.equal(stakeAmount);
            expect(await tdusk.balanceOf(await unipool.getAddress())).to.equal(stakeAmount);

            await expect(unipool.connect(addr2).stake(stakeAmount, ""))
                .to.emit(unipool, "Staked")
                .withArgs(addr2.address, stakeAmount, "");


            expect(await unipool.balanceOf(addr1.address)).to.equal(stakeAmount);
            expect(await unipool.balanceOf(addr2.address)).to.equal(stakeAmount);
            expect(await unipool.totalSupply()).to.equal(stakeAmount * 2n);
            expect(await tdusk.balanceOf(await unipool.getAddress())).to.equal(stakeAmount * 2n);
        });

        it("should allow users to withdraw staked tokens", async function () {
            const { unipool, addr1, addr2, stakeAmount } = await loadFixture(deployUnipoolFixture);

            await unipool.connect(addr1).stake(stakeAmount, "");
            await unipool.connect(addr2).stake(stakeAmount, "");

            expect(await unipool.balanceOf(addr1.address)).to.equal(stakeAmount);
            expect(await unipool.balanceOf(addr2.address)).to.equal(stakeAmount);
            expect(await unipool.totalSupply()).to.equal(stakeAmount * 2n);

            await expect(unipool.connect(addr1).withdraw(stakeAmount))
                .to.emit(unipool, "Withdrawn")
                .withArgs(addr1.address, stakeAmount);

            expect(await unipool.balanceOf(addr1.address)).to.equal(0);
            expect(await unipool.balanceOf(addr2.address)).to.equal(stakeAmount);
            expect(await unipool.totalSupply()).to.equal(stakeAmount);
        });

        it("should accrue rewards over time", async function () {
            const { unipool, addr1, stakeAmount } = await loadFixture(deployUnipoolFixture);

            await unipool.connect(addr1).stake(stakeAmount, "");
            await unipool.initializeStakingPeriod();

            await time.increase(time.duration.days(43));

            const earnedRewards = await unipool.earned(addr1.address);
            const expectedRewards = hre.ethers.parseEther("2500000");
            const margin = hre.ethers.parseEther("0.01");


            expect(earnedRewards).to.be.closeTo(expectedRewards, margin, "Earned rewards are not within the expected range");
        });

        it("Two stakers with different (1:3) stakes wait 3 weeks", async function () {
            const { unipool, addr1, addr2 } = await loadFixture(deployUnipoolFixture);

            // Users stake a different amount in a 1:3 ratio
            const stakeAmount1 = hre.ethers.parseEther("1");
            const stakeAmount2 = hre.ethers.parseEther("3");
            await unipool.connect(addr1).stake(stakeAmount1, "");
            await unipool.connect(addr2).stake(stakeAmount2, "");

            await unipool.initializeStakingPeriod();
            // Simulate passage of 21 days
            await time.increase(time.duration.weeks(3));

            // Rewards for the first 21 days
            const totalRewards = hre.ethers.parseEther("2500000"); // Total
            const margin = hre.ethers.parseEther("1"); // Margin we allow for
            const daysPassed = 21n;
            const totalDays = 43n;
            const expectedRewards = totalRewards * daysPassed / totalDays;
            const expectedReward1 = expectedRewards / 4n; // 1 part for addr1
            const expectedReward2 = expectedRewards - expectedReward1; // Remaining 3 parts for addr2

            const earnedAddr1 = await unipool.earned(addr1.address);
            const earnedAddr2 = await unipool.earned(addr2.address);

            expect(earnedAddr1).to.be.closeTo(expectedReward1, margin, "Staker 1's earned rewards are incorrect");
            expect(earnedAddr2).to.be.closeTo(expectedReward2, margin, "Staker 2's earned rewards are incorrect");
        });

        it("should distribute rewards correctly when one user leaves midway", async function () {
            const { unipool, addr1, addr2, stakeAmount } = await loadFixture(deployUnipoolFixture);

            // Both users stake the same amount
            await unipool.connect(addr1).stake(stakeAmount, "");
            await unipool.connect(addr2).stake(stakeAmount, "");

            await unipool.initializeStakingPeriod();
            // Simulate passage of 21 days
            await time.increase(time.duration.days(21));

            // Rewards for the first 21 days
            const totalRewards = hre.ethers.parseEther("2500000");
            const rewardsFirstPeriod = totalRewards * 21n / 43n;
            const rewardPerAddrFirstPeriod = rewardsFirstPeriod / 2n;

            // First user withdraws their stake
            await unipool.connect(addr1).withdraw(stakeAmount);

            // Simulate remaining 22 days
            await time.increase(time.duration.days(22));

            // Rewards for the second period (only for addr2)
            const rewardsSecondPeriod = totalRewards * 22n / 43n;
            const totalRewardAddr2 = rewardPerAddrFirstPeriod + rewardsSecondPeriod;

            // Check rewards
            const earnedAddr1 = await unipool.earned(addr1.address);
            const earnedAddr2 = await unipool.earned(addr2.address);
            const margin = hre.ethers.parseEther("1");

            expect(earnedAddr1).to.be.closeTo(rewardPerAddrFirstPeriod, margin, "Staker 1's earned rewards are incorrect after withdrawal");
            expect(earnedAddr2).to.be.closeTo(totalRewardAddr2, margin, "Staker 2's earned rewards are incorrect after full period");
        });


        it("should only allow the start of the staking program by the owner", async function () {
            const { unipool, addr1 } = await loadFixture(deployUnipoolFixture);

            await expect(unipool.connect(addr1).initializeStakingPeriod()).to.be.revertedWith("Only owner");
        });

        it("should revert when a user tries to withdraw more than they have staked", async function () {
            const { unipool, addr1, stakeAmount } = await loadFixture(deployUnipoolFixture);

            await unipool.connect(addr1).stake(stakeAmount, "");

            // Attempt to withdraw more than the staked amount
            const excessiveWithdrawAmount = stakeAmount + hre.ethers.parseEther("10");

            await expect(unipool.connect(addr1).withdraw(excessiveWithdrawAmount))
                .to.be.reverted;
        });

        it("should revert when a user tries to stake more tokens than they own", async function () {
            const { unipool, addr1, tdusk } = await loadFixture(deployUnipoolFixture);

            const userBalance = await tdusk.balanceOf(addr1.address);

            // Attempt to stake more than the user's balance
            const excessiveStakeAmount = userBalance + hre.ethers.parseEther("10");

            await expect(unipool.connect(addr1).stake(excessiveStakeAmount, ""))
                .to.be.reverted;
        });
    });
});
