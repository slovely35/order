// utils/formatOrderNumber.js
function formatOrderNumber(number) {
    return number.toString().padStart(5, '0');
}

module.exports = formatOrderNumber;