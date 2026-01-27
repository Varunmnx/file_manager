/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Aggregate, AggregateOptions, Document, Model, PipelineStage, QueryFilter, UpdateQuery } from 'mongoose';

export abstract class EntityRepository<T extends Document> {
  constructor(protected readonly entityModel: Model<T>) {}

  async findOne(entityFilterQuery: QueryFilter<T>, projection?: Record<string, unknown>): Promise<T | null> {
    try {
      return await this.entityModel
        .findOne(entityFilterQuery, {
          __v: 0,
          ...projection,
        })
        .exec();
    } catch (error) {
      console.error('Error in findOne:', error);
      return null;
    }
  }

  async find(entityFilterQuery: QueryFilter<T>, populateFields: string[] = []): Promise<T[]> {
    try {
      let query = this.entityModel.find(entityFilterQuery);
      populateFields.forEach((field) => {
        query = query.populate(field);
      });
      return await query.exec();
    } catch (error) {
      console.error('Error in find:', error);
      return [];
    }
  }

  async create(createEntityData: Partial<T>): Promise<T> {
    try {
      const entity = new this.entityModel(createEntityData);
      const savedEntity = await entity.save();
      return savedEntity as T;
    } catch (error) {
      console.error('Error in create:', error);
      throw error;
    }
  }

  async findOneAndUpdate(entityFilterQuery: QueryFilter<T>, updateEntityData: UpdateQuery<T>): Promise<T | null> {
    try {
      return await this.entityModel
        .findOneAndUpdate(entityFilterQuery, updateEntityData, {
          new: true,
        })
        .exec();
    } catch (error) {
      console.error('Error in findOneAndUpdate:', error);
      return null;
    }
  }

  async deleteMany(entityFilterQuery: QueryFilter<T>): Promise<boolean> {
    try {
      const deleteResult = await this.entityModel.deleteMany(entityFilterQuery);
      return deleteResult.deletedCount >= 1;
    } catch (error) {
      console.error('Error in deleteMany:', error);
      return false;
    }
  }

  async deleteOne(entityFilterQuery: QueryFilter<T>): Promise<boolean> {
    try {
      const deleteResult = await this.entityModel.deleteOne(entityFilterQuery);
      return deleteResult.deletedCount >= 1;
    } catch (error) {
      console.error('Error in deleteOne:', error);
      return false;
    }
  }

  async aggregate<R = any>(pipeline: PipelineStage[] = [], options?: AggregateOptions): Promise<Aggregate<R[]>> {
    try {
      return await this.entityModel.aggregate(pipeline, options).exec();
    } catch (error) {
      console.error('Error in aggregate:', error);
      return [];
    }
  }

  async countDocuments(entityFilterQuery: QueryFilter<T>): Promise<number> {
    try {
      return await this.entityModel.countDocuments(entityFilterQuery).exec();
    } catch (error) {
      console.error('Error in countDocuments:', error);
      return 0;
    }
  }
}