// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  const lpToken = await hre.ethers.deployContract("TDUSK");
  await lpToken.waitForDeployment();
  let lpTokenAddress = await lpToken.getAddress();
  console.log("LP token deployed to:", lpTokenAddress);

  const stakingContract = await hre.ethers.deployContract("Unipool", [lpTokenAddress]);
  await stakingContract.waitForDeployment();
  console.log("Staking contract deployed to:", await stakingContract.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
