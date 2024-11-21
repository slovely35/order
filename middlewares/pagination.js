// middlewares/pagination.js

function paginate(model, pageSize = 50) {
    return async (req, res, next) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = pageSize;
        const skip = (page - 1) * limit;
  
        const totalCount = await model.countDocuments();
        const totalPages = Math.ceil(totalCount / limit);
  
        const data = await model.find().skip(skip).limit(limit);
  
        res.paginatedData = {
          data,
          currentPage: page,
          totalPages,
        };
  
        next();
      } catch (error) {
        console.error('Pagination error:', error);
        res.status(500).send('Pagination error');
      }
    };
  }
  
  module.exports = paginate;
  