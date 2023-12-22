var Battleship = artifacts.require('Battleship')


module.exports = async function(deployer) {
    await deployer.deploy(Battleship);
    await Battleship.deployed();
}
