const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying to Sepolia...\n");
  const [deployer] = await hre.ethers.getSigners();
  console.log(`📋 Deploying with account: ${deployer.address}`);

  const Certificates = await hre.ethers.getContractFactory("Certificates");
  const certificates = await Certificates.deploy();
  await certificates.waitForDeployment();

  const contractAddress = await certificates.getAddress();
  console.log("\n✅ Deployment successful!");
  console.log(`📄 Contract Address : ${contractAddress}`);
  console.log(`🔗 Etherscan        : https://sepolia.etherscan.io/address/${contractAddress}`);
  console.log(`\n📝 Add this to backend/.env:\n   CONTRACT_ADDRESS=${contractAddress}\n`);
}

main().catch((error) => { console.error("❌ Deployment failed:", error); process.exit(1); });